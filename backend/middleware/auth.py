"""
Auth Middleware — Verificação de JWT via Supabase Auth.

get_current_user valida o token com supabase_auth_verify.auth.get_user() e resolve
o usuário em public.users via auth_id (ponte com auth.users do Supabase).

O client `supabase` importado é service_role (bypassa RLS) — as queries
em public.users são feitas com ele, não com o token do usuário.
"""

import logging
import os
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from db.database import engine
from db.supabase_client import supabase, supabase_auth_verify

logger = logging.getLogger("stockops.auth")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


USER_SELECT = "id, username, email, role, tenant_id, auth_id, nome_exibicao, tipo_perfil, empresa_nome"
DIRECT_SQL_FALLBACK_ENABLED = os.getenv(
    "ENABLE_DIRECT_SQL_FALLBACK", "false"
).lower() in {
    "1",
    "true",
    "yes",
    "on",
}


def _fetch_one_sql(query: str, params: dict | None = None) -> dict | None:
    if not DIRECT_SQL_FALLBACK_ENABLED:
        return None

    try:
        with engine.connect() as conn:
            row = conn.execute(text(query), params or {}).mappings().first()
        return dict(row) if row else None
    except SQLAlchemyError as e:
        logger.warning("Fallback SQL indisponivel durante leitura: %s", e)
        return None


def _execute_sql(query: str, params: dict | None = None) -> None:
    if not DIRECT_SQL_FALLBACK_ENABLED:
        raise SQLAlchemyError("Direct SQL fallback disabled")

    with engine.begin() as conn:
        conn.execute(text(query), params or {})


def _get_user_row_by_auth_id(auth_id: str) -> dict | None:
    result = (
        supabase.table("users").select(USER_SELECT).eq("auth_id", auth_id).execute()
    )
    if result.data:
        return result.data[0]

    return _fetch_one_sql(
        """
        select
            id::text as id,
            username,
            email,
            role,
            tenant_id::text as tenant_id,
            auth_id::text as auth_id,
            nome_exibicao,
            tipo_perfil,
            empresa_nome
        from public.users
        where auth_id::text = :auth_id
        limit 1
        """,
        {"auth_id": auth_id},
    )


def _get_existing_tenant_id() -> str | None:
    """Retorna um tenant existente sem criar registros (evita RLS em INSERT)."""
    primary = (
        supabase.table("tenants")
        .select("id")
        .eq("slug", "stockops-v1")
        .limit(1)
        .execute()
    )
    if primary.data:
        return str(primary.data[0]["id"])

    primary_sql = _fetch_one_sql(
        "select id::text as id from public.tenants where slug = :slug limit 1",
        {"slug": "stockops-v1"},
    )
    if primary_sql:
        return str(primary_sql["id"])

    any_tenant = supabase.table("tenants").select("id").limit(1).execute()
    if any_tenant.data:
        return str(any_tenant.data[0]["id"])

    any_tenant_sql = _fetch_one_sql(
        "select id::text as id from public.tenants order by created_at nulls last, id limit 1"
    )
    if any_tenant_sql:
        return str(any_tenant_sql["id"])
    return None


def _create_profile_if_missing(auth_id: str, email: str | None) -> bool:
    """Cria perfil mínimo em public.users para usuários válidos do Supabase Auth."""
    tenant_id = _get_existing_tenant_id()
    if not tenant_id:
        logger.warning(
            "Nenhum tenant encontrado para vincular auth_id=%s. "
            "Execute a migration 010_bootstrap_demo_tenant_and_auth_profiles.sql no Supabase SQL Editor para criar o tenant stockops-v1.",
            auth_id,
        )
        return False

    local = (email or "user").split("@")[0].strip().lower() or "user"
    username = f"{local}_{auth_id[:8]}"
    try:
        supabase.table("users").insert(
            {
                "tenant_id": tenant_id,
                "username": username,
                "password_hash": "__supabase_auth__",
                "role": "viewer",
                "email": email,
                "auth_id": auth_id,
            }
        ).execute()
        return True
    except Exception as e:
        logger.warning(
            "Falha ao auto-criar perfil via Supabase auth_id=%s: %s", auth_id, e
        )

    try:
        _execute_sql(
            """
            insert into public.users (tenant_id, username, password_hash, role, email, auth_id)
            values (:tenant_id, :username, :password_hash, :role, :email, :auth_id)
            """,
            {
                "tenant_id": tenant_id,
                "username": username,
                "password_hash": "__supabase_auth__",
                "role": "viewer",
                "email": email,
                "auth_id": auth_id,
            },
        )
        return True
    except SQLAlchemyError as e:
        logger.error("Falha ao auto-criar perfil auth_id=%s: %s", auth_id, e)
        return False


def _link_profile_by_email(auth_id: str, email: str | None) -> bool:
    """Tenta vincular auth_id a um perfil existente em public.users pelo email."""
    if not email:
        return False

    existing = (
        supabase.table("users")
        .select("id, auth_id")
        .eq("email", email)
        .limit(1)
        .execute()
    )
    row = existing.data[0] if existing.data else None
    if row is None:
        row = _fetch_one_sql(
            "select id::text as id, auth_id::text as auth_id from public.users where email = :email limit 1",
            {"email": email},
        )
    if row is None:
        return False

    if row.get("auth_id"):
        return str(row.get("auth_id")) == auth_id

    try:
        supabase.table("users").update({"auth_id": auth_id}).eq(
            "id", row["id"]
        ).execute()
        return True
    except Exception:
        try:
            _execute_sql(
                "update public.users set auth_id = :auth_id where id::text = :user_id",
                {"auth_id": auth_id, "user_id": str(row["id"])},
            )
            return True
        except SQLAlchemyError as e:
            logger.warning(
                "Falha ao vincular auth_id por email=%s user_id=%s: %s",
                email,
                row.get("id"),
                e,
            )
            return False


def _get_user_row_by_email(email: str | None):
    if not email:
        return None

    result = (
        supabase.table("users")
        .select(USER_SELECT)
        .eq("email", email)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]

    return _fetch_one_sql(
        """
        select
            id::text as id,
            username,
            email,
            role,
            tenant_id::text as tenant_id,
            auth_id::text as auth_id,
            nome_exibicao,
            tipo_perfil,
            empresa_nome
        from public.users
        where email = :email
        limit 1
        """,
        {"email": email},
    )


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Verifica o JWT emitido pelo Supabase Auth e resolve o usuário em public.users.

    Fluxo:
        1. supabase_auth_verify.auth.get_user(token) → valida assinatura e expiração
        2. public.users.eq("auth_id", user.id) → resolve tenant_id, role e perfil
        3. Retorna dict com user_id, email, role, tenant_id, auth_id,
           nome_exibicao, tipo_perfil, empresa_nome

    Raises:
        HTTPException 401: Token inválido, expirado ou usuário sem perfil em public.users
    """
    try:
        auth_response = supabase_auth_verify.auth.get_user(token)
        if not auth_response or not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido",
            )
        auth_id = str(auth_response.user.id)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Falha ao verificar token Supabase Auth: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )

    try:
        row = _get_user_row_by_auth_id(auth_id)
        if row is None:
            row = _get_user_row_by_email(auth_response.user.email)
            if row:
                current_auth_id = row.get("auth_id")
                if current_auth_id is None:
                    try:
                        _link_profile_by_email(auth_id, auth_response.user.email)
                        row["auth_id"] = auth_id
                    except Exception as e:
                        logger.warning(
                            "Falha ao vincular auth_id por email user_id=%s: %s",
                            row.get("id"),
                            e,
                        )
                elif str(current_auth_id) != auth_id:
                    row = None

        if row is None:
            linked = _link_profile_by_email(auth_id, auth_response.user.email)
            created = False
            if not linked:
                created = _create_profile_if_missing(auth_id, auth_response.user.email)

            if linked or created:
                row = _get_user_row_by_auth_id(auth_id)
            if row is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Usuário não encontrado — perfil não vinculado ao Auth",
                )
        return {
            "user_id": str(row["id"]),
            "username": row.get("username"),
            "email": row.get("email"),
            "role": row["role"],
            "tenant_id": str(row["tenant_id"]),
            "auth_id": str(row["auth_id"]),
            "nome_exibicao": row.get("nome_exibicao"),
            "tipo_perfil": row.get("tipo_perfil"),
            "empresa_nome": row.get("empresa_nome"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar usuário por auth_id={auth_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Erro ao verificar usuário",
        )
