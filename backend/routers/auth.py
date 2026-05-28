"""
Auth Router — Endpoints de autenticação via Supabase Auth.

Fluxo de login com 2FA por email:
  1. POST /auth/login  → sign_in_with_password → Supabase dispara OTP por email
  2. POST /auth/verify → verify_otp            → retorna JWT final (access_token)

O JWT retornado é emitido pelo Supabase Auth e verificado por get_current_user()
em middleware/auth.py via supabase_auth_verify.auth.get_user(token).
"""

import logging
from fastapi import APIRouter, HTTPException, Depends, Request, status
from models.schemas import (
    UserRegister,
    UserLogin,
    OTPVerify,
    Token,
    ForgotPassword,
    ProfileUpdate,
)
from middleware.auth import oauth2_scheme, get_current_user
from middleware.rate_limit import limiter
from db.supabase_client import supabase, supabase_auth
from services.tenant_service import create_tenant

logger = logging.getLogger("stockops.auth")

router = APIRouter(prefix="/auth", tags=["auth"])


def _tenant_name_for_user(
    tipo_perfil: str,
    empresa_nome: str | None,
    nome_exibicao: str | None,
    email: str,
) -> str:
    """
    Determina o nome do tenant a criar:
      - empresa     → empresa_nome (obrigatório)
      - colaborador → nome_exibicao ou prefixo do email

    Raises:
        HTTPException 400: se tipo_perfil == 'empresa' e empresa_nome ausente.
    """
    if tipo_perfil == "empresa":
        if not empresa_nome or not empresa_nome.strip():
            raise HTTPException(
                status_code=400,
                detail="empresa_nome é obrigatório para tipo_perfil 'empresa'",
            )
        return empresa_nome.strip()
    label = (nome_exibicao or email.split("@")[0]).strip()
    return label or "colaborador"


@router.post("/register", status_code=201)
@limiter.limit("5/minute")
def register(request: Request, data: UserRegister):
    """
    Cria conta no Supabase Auth, tenant próprio e perfil em public.users.

    Fluxo:
        1. supabase.auth.sign_up → cria auth.users, retorna auth_id
        2. Cria tenant próprio usando auth_id[:8] como sufixo do slug:
           - tipo_perfil='empresa'     → nome = empresa_nome
           - tipo_perfil='colaborador' → nome = nome_exibicao (ou prefixo email)
        3. INSERT public.users com auth_id, tenant_id, role='admin'
        4. Supabase envia email de confirmação automaticamente

    O campo tenant_id do payload é ignorado — cada registro gera tenant próprio.

    Rate limit: 5/minute por IP.
    """
    try:
        # Valida nome do tenant antes de chamar Supabase Auth (fail fast)
        tenant_name = _tenant_name_for_user(
            tipo_perfil=data.tipo_perfil,
            empresa_nome=data.empresa_nome,
            nome_exibicao=data.nome_exibicao,
            email=data.email,
        )

        # Auth primeiro: auth_id usado como sufixo de slug (garante unicidade)
        auth_response = supabase_auth.auth.sign_up(
            {"email": data.email, "password": data.password}
        )
        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Erro ao criar conta no Auth")

        auth_id = str(auth_response.user.id)
        tenant_id = create_tenant(tenant_name, slug_suffix=auth_id[:8])
        user_data: dict = {
            "email": data.email,
            "tenant_id": tenant_id,
            "role": "admin",
            "auth_id": auth_id,
            "tipo_perfil": data.tipo_perfil,
        }
        if data.username:
            user_data["username"] = data.username
        if data.nome_exibicao:
            user_data["nome_exibicao"] = data.nome_exibicao
        if data.empresa_nome:
            user_data["empresa_nome"] = data.empresa_nome

        result = supabase.table("users").insert(user_data).execute()
        if not result.data:
            raise HTTPException(
                status_code=500, detail="Erro ao criar perfil do usuário"
            )

        logger.info(
            f"Usuário registrado: {data.email} "
            f"(tenant={tenant_id}, tipo={data.tipo_perfil})"
        )
        return {
            "message": "Usuário criado. Verifique seu email para confirmar o cadastro."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao registrar {data.email}: {e}")
        raise HTTPException(
            status_code=400,
            detail="Erro ao criar conta — email já cadastrado ou inválido",
        )


@router.post("/login", status_code=200)
@limiter.limit("5/minute")
def login(request: Request, data: UserLogin):
    """
    Autenticação em dois passos:
      1. sign_in_with_password → valida credenciais (401 se inválidas)
      2. sign_in_with_otp      → envia código OTP para o email
    O JWT só é emitido após POST /auth/verify com o código recebido.

    Rate limit: 5/minute por IP (proteção brute-force).
    """
    # Passo 1: valida senha
    try:
        supabase_auth.auth.sign_in_with_password(
            {"email": data.email, "password": data.password}
        )
    except Exception as e:
        logger.warning(f"Falha de login para {data.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
        )

    # Passo 2: encerra a sessão aberta pelo sign_in_with_password para que o
    # cliente Supabase não trate o sign_in_with_otp como usuário já autenticado
    # (o que faz o Supabase ignorar silenciosamente o envio do email OTP).
    try:
        supabase_auth.auth.sign_out()
    except Exception:
        pass  # best-effort — não bloqueia o fluxo

    # Passo 3: envia OTP por email
    try:
        supabase_auth.auth.sign_in_with_otp({"email": data.email})
        logger.info(f"[2FA] sign_in_with_otp disparado para {data.email}")
        return {"message": "Código 2FA enviado para o email"}
    except Exception as e:
        logger.error(f"Erro ao enviar OTP para {data.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao enviar código 2FA — tente novamente",
        )


@router.post("/verify", response_model=Token)
@limiter.limit("5/minute")
def verify(request: Request, data: OTPVerify):
    """
    Verifica o código OTP enviado por email. Retorna JWT Supabase Auth.

    O access_token retornado deve ser usado como Bearer token em todas
    as rotas protegidas.

    Rate limit: 5/minute por IP.
    """
    try:
        auth_response = supabase_auth.auth.verify_otp(
            {"email": data.email, "token": data.token, "type": "email"}
        )
        if not auth_response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="OTP inválido ou expirado",
            )
        logger.info(f"OTP verificado com sucesso para {data.email}")
        return Token(
            access_token=auth_response.session.access_token,
            token_type="bearer",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Falha ao verificar OTP para {data.email}: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OTP inválido ou expirado",
        )


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    """
    Retorna os dados do usuário autenticado, incluindo campos de perfil (Migrations 008/009).
    Inclui tenant_name resolvido da tabela tenants.
    """
    tenant_result = (
        supabase.table("tenants")
        .select("name")
        .eq("id", current_user["tenant_id"])
        .limit(1)
        .execute()
    )
    tenant_name = tenant_result.data[0]["name"] if tenant_result.data else None

    return {
        "id": current_user["user_id"],
        "email": current_user["email"],
        "username": current_user.get("username"),
        "nome_exibicao": current_user.get("nome_exibicao"),
        "tipo_perfil": current_user.get("tipo_perfil"),
        "empresa_nome": current_user.get("empresa_nome"),
        "role": current_user["role"],
        "tenant_id": current_user["tenant_id"],
        "tenant_name": tenant_name,
    }


@router.put("/profile", status_code=200)
async def update_profile(
    data: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
):
    """
    Atualiza campos de perfil do usuário autenticado.
    Aceita: username (com validação de unicidade por tenant), nome_exibicao,
    tipo_perfil, empresa_nome. Apenas campos enviados são atualizados (exclude_none).
    """
    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        return {"message": "Nenhum campo para atualizar"}

    if data.username:
        conflict = (
            supabase.table("users")
            .select("id")
            .eq("tenant_id", current_user["tenant_id"])
            .eq("username", data.username)
            .neq("id", current_user["user_id"])
            .execute()
        )
        if conflict.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username já está em uso.",
            )

    try:
        supabase.table("users").update(update_data).eq(
            "id", current_user["user_id"]
        ).execute()
        logger.info(f"Perfil atualizado para user_id={current_user['user_id']}")
        return {"message": "Perfil atualizado"}
    except Exception as e:
        logger.error(f"Erro ao atualizar perfil user_id={current_user['user_id']}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao atualizar perfil",
        )


@router.post("/forgot-password", status_code=200)
@limiter.limit("3/minute")
def forgot_password(request: Request, data: ForgotPassword):
    """
    Envia email de redefinição de senha via Supabase Auth.

    Sempre retorna 200 — independente de o email estar cadastrado ou não —
    para não revelar a existência de cadastros (user enumeration prevention).

    Rate limit: 3/minute por IP.
    """
    try:
        supabase_auth.auth.reset_password_for_email(data.email)
        logger.info(f"Reset de senha solicitado para {data.email}")
    except Exception as e:
        logger.warning(f"Erro ao enviar reset de senha para {data.email}: {e}")
    return {"message": "Email de redefinição enviado"}


@router.post("/logout", status_code=204)
@limiter.limit("10/minute")
def logout(request: Request, token: str = Depends(oauth2_scheme)):
    """
    Invalida a sessão ativa no Supabase Auth.
    Best-effort: o cliente deve descartar o token independentemente do resultado.
    """
    try:
        supabase.auth.admin.sign_out(token)
        logger.info("Logout realizado com sucesso")
    except Exception as e:
        logger.warning(f"Falha no logout (best-effort): {e}")
