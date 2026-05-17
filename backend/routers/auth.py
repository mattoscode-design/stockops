"""
Auth Router — Endpoints de autenticação com rate limiting anti brute-force.
"""

import logging
from fastapi import APIRouter, HTTPException, status, Request
from models.schemas import Token, UserLogin
from middleware.auth import get_user, verify_password, create_token
from middleware.rate_limit import limiter

logger = logging.getLogger("stockops.auth")

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")  # API-001: Rate limit anti brute-force
def login(request: Request, data: UserLogin):
    """
    Autentica usuário com credenciais.

    Rate limit: 5 tentativas por minuto por IP (proteção brute-force)

    Args:
        request: HTTP request (necessário para rate limiting)
        data: UserLogin com username e password

    Returns:
        Token JWT com access_token e token_type

    Raises:
        HTTPException 401: Se credenciais inválidas
        HTTPException 429: Se rate limit excedido
    """
    user = get_user(data.username)
    if not user or not verify_password(data.password, user["password"]):
        logger.warning(
            f"Tentativa de login falhou para {data.username} de {request.client.host}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas"
        )

    token = create_token({
        "sub": data.username,
        "role": user["role"],
        "tenant_id": user["tenant_id"],
        "user_id": user["user_id"],
    })
    logger.info(f"Login bem-sucedido para {data.username}")
    return {"access_token": token, "token_type": "bearer"}
