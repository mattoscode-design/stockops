"""
Team Router — Gerenciamento do time/tenant do usuário autenticado.

Prefixo: /team
Todos os endpoints que precisam de tenant_id usam current_user["tenant_id"].

Endpoints (10):
  GET    /team/tenants/search               → Buscar tenants por nome
  POST   /team/invites                      → Admin convida por email
  GET    /team/invites/{token}              → Detalhes do convite por token (sem auth)
  POST   /team/invites/{token}/accept       → Aceitar convite
  POST   /team/join-requests               → Solicitar entrada em tenant (tenant_id no body)
  GET    /team/join-requests               → Listar solicitações pendentes (admin)
  POST   /team/join-requests/{id}/approve  → Admin aprova solicitação
  POST   /team/join-requests/{id}/reject   → Admin rejeita solicitação
  GET    /team/members                     → Listar membros do próprio tenant (admin)
  DELETE /team/members/{userId}            → Remover membro (admin)
"""

import logging
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from postgrest.exceptions import APIError

from db.supabase_client import supabase
from middleware.auth import get_current_user
from middleware.rate_limit import limiter
from models.schemas import InviteCreate, JoinRequestCreate
from services.tenant_service import create_tenant

logger = logging.getLogger("stockops.tenants")

router = APIRouter(prefix="/team", tags=["team"])


# ─────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────


def _require_admin_role(current_user: dict) -> None:
    """Garante que o usuário autenticado tem role admin no próprio tenant."""
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado: apenas administradores podem realizar esta ação",
        )


def _require_admin(current_user: dict, tenant_id: str) -> None:
    """Garante que o usuário é admin do tenant especificado (para approve/reject)."""
    if current_user["tenant_id"] != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado: você não pertence a este tenant",
        )
    _require_admin_role(current_user)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _raise_if_missing_table(error: APIError, table_name: str) -> None:
    """Converte erro de schema cache ausente em HTTPException amigável."""
    text = str(error).lower()
    if "pgrst205" in text and table_name.lower() in text and "schema cache" in text:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                f"Infra incompleta: tabela '{table_name}' não existe no Supabase. "
                "Execute a migration 011_tenant_invites_join_requests.sql no SQL Editor e tente novamente."
            ),
        )


def _fetch_invite_by_token(token: str) -> dict:
    try:
        result = (
            supabase.table("tenant_invites")
            .select("*")
            .eq("token", token)
            .limit(1)
            .execute()
        )
    except APIError as e:
        _raise_if_missing_table(e, "tenant_invites")
        raise
    if not result.data:
        raise HTTPException(status_code=404, detail="Convite não encontrado")
    return result.data[0]


# ─────────────────────────────────────────────────────────────────────────────
# 1. GET /team/tenants/search
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/tenants/search")
@limiter.limit("30/minute")
def search_tenants(
    request: Request,
    q: str = Query(
        default="", description="Busca por nome (parcial, case-insensitive)"
    ),
    current_user: dict = Depends(get_current_user),
):
    """Busca tenants pelo nome. Retorna até 20 resultados."""
    query = supabase.table("tenants").select("id, name, slug, plan")
    if q.strip():
        query = query.ilike("name", f"%{q.strip()}%")
    result = query.limit(20).execute()
    return result.data or []


# ─────────────────────────────────────────────────────────────────────────────
# 2. POST /team/invites
# ─────────────────────────────────────────────────────────────────────────────


@router.post("/invites", status_code=201)
@limiter.limit("10/minute")
def send_invite(
    request: Request,
    data: InviteCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Admin convida usuário por email para o próprio tenant.
    Rejeita se já houver convite pendente para o mesmo email.
    Retorna token para o frontend construir o link de aceite.
    """
    _require_admin_role(current_user)
    tenant_id = current_user["tenant_id"]
    # Normaliza email para evitar duplicatas por case/espaços
    normalized_email = data.email.strip().lower()

    try:
        existing = (
            supabase.table("tenant_invites")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("invited_email", normalized_email)
            .eq("status", "pending")
            .limit(1)
            .execute()
        )
    except APIError as e:
        _raise_if_missing_table(e, "tenant_invites")
        raise
    if existing.data:
        raise HTTPException(
            status_code=400,
            detail="Já existe um convite pendente para este email neste tenant",
        )

    token = secrets.token_urlsafe(32)
    try:
        result = (
            supabase.table("tenant_invites")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "invited_email": normalized_email,
                    "invited_by": current_user["user_id"],
                    "role": data.role,
                    "token": token,
                    "status": "pending",
                }
            )
            .execute()
        )
    except APIError as e:
        _raise_if_missing_table(e, "tenant_invites")
        raise

    if not result.data:
        raise HTTPException(status_code=500, detail="Erro ao criar convite")

    # Busca nome do tenant para o email (best-effort — não bloqueia em falha)
    try:
        tenant_result = (
            supabase.table("tenants")
            .select("name")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        )
        tenant_name = tenant_result.data[0]["name"] if tenant_result.data else tenant_id
    except Exception:
        tenant_name = tenant_id

    inviter_name = (
        current_user.get("nome_exibicao")
        or current_user.get("username")
        or current_user["email"]
    )

    from services.email_service import send_invite_email  # noqa: PLC0415
    send_invite_email(
        to_email=normalized_email,
        tenant_name=tenant_name,
        inviter_name=inviter_name,
        token=token,
    )

    logger.info(
        "Convite criado: tenant=%s → %s (role=%s)", tenant_id, normalized_email, data.role
    )
    return {
        "message": "Convite criado com sucesso",
        "token": token,
        "invited_email": normalized_email,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. GET /team/invites/{token}
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/invites/{token}")
@limiter.limit("30/minute")
def get_invite(
    request: Request,
    token: str,
):
    """
    Retorna detalhes públicos do convite — sem autenticação.
    Usado pelo frontend para exibir informações antes do aceite.
    """
    invite = _fetch_invite_by_token(token)

    tenant_result = (
        supabase.table("tenants")
        .select("name, slug")
        .eq("id", invite["tenant_id"])
        .limit(1)
        .execute()
    )
    tenant_name = (
        tenant_result.data[0]["name"] if tenant_result.data else invite["tenant_id"]
    )

    return {
        "id": invite["id"],
        "tenant_id": invite["tenant_id"],
        "tenant_name": tenant_name,
        "invited_email": invite["invited_email"],
        "role": invite["role"],
        "status": invite["status"],
        "expires_at": invite["expires_at"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. POST /team/invites/{token}/accept
# ─────────────────────────────────────────────────────────────────────────────


@router.post("/invites/{token}/accept", status_code=200)
@limiter.limit("10/minute")
def accept_invite(
    request: Request,
    token: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Aceita convite por token (path param). Valida:
      - Token existe e está pendente
      - Não expirou
      - Email do usuário autenticado corresponde ao email convidado
    Efeito: atualiza tenant_id e role; marca convite como aceito.
    """
    invite = _fetch_invite_by_token(token)

    if invite["status"] != "pending":
        raise HTTPException(
            status_code=400, detail=f"Convite já foi {invite['status']}"
        )

    expires_at = datetime.fromisoformat(invite["expires_at"].replace("Z", "+00:00"))
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Convite expirado")

    if invite["invited_email"].strip().lower() != (current_user.get("email") or "").strip().lower():
        raise HTTPException(
            status_code=403, detail="Este convite não pertence ao seu email"
        )

    supabase.table("users").update(
        {"tenant_id": invite["tenant_id"], "role": invite["role"]}
    ).eq("id", current_user["user_id"]).execute()

    supabase.table("tenant_invites").update(
        {"status": "accepted", "accepted_at": _now_iso()}
    ).eq("id", invite["id"]).execute()

    logger.info(
        "Convite aceito: user=%s → tenant=%s",
        current_user["email"],
        invite["tenant_id"],
    )
    return {
        "message": "Convite aceito. Bem-vindo ao tenant!",
        "tenant_id": invite["tenant_id"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5. POST /team/join-requests
# ─────────────────────────────────────────────────────────────────────────────


@router.post("/join-requests", status_code=201)
@limiter.limit("10/minute")
def request_join(
    request: Request,
    data: JoinRequestCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Solicita entrada em um tenant externo. tenant_id vem no body.
    Bloqueia: mesmo tenant, pendente/aprovada. Reabre rejeitada.
    """
    tenant_id = data.tenant_id

    if current_user["tenant_id"] == tenant_id:
        raise HTTPException(status_code=400, detail="Você já pertence a este tenant")

    tenant_result = (
        supabase.table("tenants").select("id").eq("id", tenant_id).limit(1).execute()
    )
    if not tenant_result.data:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")

    try:
        existing = (
            supabase.table("tenant_join_requests")
            .select("id, status")
            .eq("tenant_id", tenant_id)
            .eq("user_id", current_user["user_id"])
            .limit(1)
            .execute()
        )
    except APIError as e:
        _raise_if_missing_table(e, "tenant_join_requests")
        raise

    if existing.data:
        prev = existing.data[0]
        if prev["status"] == "pending":
            raise HTTPException(
                status_code=400,
                detail="Você já tem uma solicitação pendente para este tenant",
            )
        if prev["status"] == "approved":
            raise HTTPException(
                status_code=400, detail="Você já foi aprovado neste tenant"
            )
        # rejected → reabre
        try:
            supabase.table("tenant_join_requests").update(
                {
                    "status": "pending",
                    "message": data.message,
                    "reviewed_by": None,
                    "reviewed_at": None,
                }
            ).eq("id", prev["id"]).execute()
        except APIError as e:
            _raise_if_missing_table(e, "tenant_join_requests")
            raise
        logger.info(
            "Solicitação reaberta: user=%s → tenant=%s",
            current_user["user_id"],
            tenant_id,
        )
        return {
            "message": "Solicitação reenviada. Aguarde aprovação do administrador.",
            "request_id": prev["id"],
        }

    try:
        result = (
            supabase.table("tenant_join_requests")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "user_id": current_user["user_id"],
                    "status": "pending",
                    "message": data.message,
                }
            )
            .execute()
        )
    except APIError as e:
        _raise_if_missing_table(e, "tenant_join_requests")
        raise

    if not result.data:
        raise HTTPException(status_code=500, detail="Erro ao criar solicitação")

    logger.info(
        "Solicitação criada: user=%s → tenant=%s", current_user["user_id"], tenant_id
    )
    return {
        "message": "Solicitação enviada. Aguarde aprovação do administrador.",
        "request_id": result.data[0]["id"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# 6. GET /team/join-requests
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/join-requests")
@limiter.limit("30/minute")
def list_join_requests(
    request: Request,
    status: str = Query(
        default="pending", description="Filtrar por status: pending, approved, rejected"
    ),
    current_user: dict = Depends(get_current_user),
):
    """Lista solicitações de entrada no próprio tenant. Restrito a admins."""
    _require_admin_role(current_user)
    try:
        result = (
            supabase.table("tenant_join_requests")
            .select("*")
            .eq("tenant_id", current_user["tenant_id"])
            .eq("status", status)
            .execute()
        )
    except APIError as e:
        _raise_if_missing_table(e, "tenant_join_requests")
        raise
    return result.data or []


# ─────────────────────────────────────────────────────────────────────────────
# 8. POST /team/join-requests/{request_id}/approve
# ─────────────────────────────────────────────────────────────────────────────


@router.post("/join-requests/{request_id}/approve", status_code=200)
@limiter.limit("30/minute")
def approve_join_request(
    request: Request,
    request_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Admin aprova solicitação: move solicitante para o tenant com role=viewer."""
    try:
        req_result = (
            supabase.table("tenant_join_requests")
            .select("*")
            .eq("id", request_id)
            .limit(1)
            .execute()
        )
    except APIError as e:
        _raise_if_missing_table(e, "tenant_join_requests")
        raise
    if not req_result.data:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")

    join_req = req_result.data[0]
    _require_admin(current_user, join_req["tenant_id"])

    if join_req["status"] != "pending":
        raise HTTPException(
            status_code=400, detail=f"Solicitação já foi {join_req['status']}"
        )

    supabase.table("users").update(
        {"tenant_id": join_req["tenant_id"], "role": "viewer"}
    ).eq("id", join_req["user_id"]).execute()

    try:
        supabase.table("tenant_join_requests").update(
            {
                "status": "approved",
                "reviewed_by": current_user["user_id"],
                "reviewed_at": _now_iso(),
            }
        ).eq("id", request_id).execute()
    except APIError as e:
        _raise_if_missing_table(e, "tenant_join_requests")
        raise

    logger.info(
        "Solicitação aprovada: user=%s → tenant=%s",
        join_req["user_id"],
        join_req["tenant_id"],
    )
    return {"message": "Solicitação aprovada"}


# ─────────────────────────────────────────────────────────────────────────────
# 7. POST /team/join-requests/{request_id}/reject
# ─────────────────────────────────────────────────────────────────────────────


@router.post("/join-requests/{request_id}/reject", status_code=200)
@limiter.limit("30/minute")
def reject_join_request(
    request: Request,
    request_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Admin rejeita solicitação de entrada."""
    try:
        req_result = (
            supabase.table("tenant_join_requests")
            .select("*")
            .eq("id", request_id)
            .limit(1)
            .execute()
        )
    except APIError as e:
        _raise_if_missing_table(e, "tenant_join_requests")
        raise
    if not req_result.data:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")

    join_req = req_result.data[0]
    _require_admin(current_user, join_req["tenant_id"])

    if join_req["status"] != "pending":
        raise HTTPException(
            status_code=400, detail=f"Solicitação já foi {join_req['status']}"
        )

    try:
        supabase.table("tenant_join_requests").update(
            {
                "status": "rejected",
                "reviewed_by": current_user["user_id"],
                "reviewed_at": _now_iso(),
            }
        ).eq("id", request_id).execute()
    except APIError as e:
        _raise_if_missing_table(e, "tenant_join_requests")
        raise

    logger.info(
        "Solicitação rejeitada: request_id=%s por admin=%s",
        request_id,
        current_user["user_id"],
    )
    return {"message": "Solicitação rejeitada"}


# ─────────────────────────────────────────────────────────────────────────────
# 9. GET /team/members
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/members")
@limiter.limit("30/minute")
def list_members(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Lista todos os membros do próprio tenant. Restrito a admins."""
    _require_admin_role(current_user)

    result = (
        supabase.table("users")
        .select("id, email, username, nome_exibicao, role, tipo_perfil")
        .eq("tenant_id", current_user["tenant_id"])
        .execute()
    )
    return result.data or []


# ─────────────────────────────────────────────────────────────────────────────
# 10. DELETE /team/members/{userId}
# ─────────────────────────────────────────────────────────────────────────────


@router.delete("/members/{user_id}", status_code=200)
@limiter.limit("10/minute")
def remove_member(
    request: Request,
    user_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Remove membro do próprio tenant. Admin não pode se remover.
    Efeito: cria tenant pessoal para o removido (tenant_id NOT NULL).
    """
    _require_admin_role(current_user)
    tenant_id = current_user["tenant_id"]

    if current_user["user_id"] == user_id:
        raise HTTPException(
            status_code=400, detail="Administrador não pode remover a si mesmo"
        )

    member_result = (
        supabase.table("users")
        .select("id, email, username")
        .eq("id", user_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    )
    if not member_result.data:
        raise HTTPException(
            status_code=404, detail="Membro não encontrado neste tenant"
        )

    member = member_result.data[0]
    label = (member.get("username") or member["email"].split("@")[0]).strip()
    new_tenant_id = create_tenant(label)

    supabase.table("users").update({"tenant_id": new_tenant_id, "role": "admin"}).eq(
        "id", user_id
    ).execute()

    logger.info(
        "Membro removido: user_id=%s de tenant=%s → novo tenant=%s",
        user_id,
        tenant_id,
        new_tenant_id,
    )
    return {"message": "Membro removido do tenant"}
