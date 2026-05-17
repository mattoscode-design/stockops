from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import os

from db.supabase_client import supabase

_jwt_secret = os.getenv("JWT_SECRET_KEY")
if not _jwt_secret:
    raise RuntimeError(
        "JWT_SECRET_KEY não configurado. "
        "Defina a variável no arquivo .env antes de iniciar o servidor."
    )
SECRET_KEY = _jwt_secret
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", 60))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_user(username: str) -> dict | None:
    """Busca usuário no Supabase pelo username.

    Returns:
        dict com 'password' (hash bcrypt), 'role' e 'tenant_id', ou None se não encontrado.
    """
    try:
        result = (
            supabase.table("users")
            .select("id, username, password_hash, role, tenant_id")
            .eq("username", username)
            .execute()
        )
        if not result.data:
            return None
        row = result.data[0]
        return {
            "password": row["password_hash"],
            "role": row["role"],
            "tenant_id": str(row["tenant_id"]),
            "user_id": str(row["id"]),
        }
    except Exception:
        return None


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=EXPIRE_MINUTES)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
        return {
            "username": username,
            "role": payload.get("role"),
            "tenant_id": payload.get("tenant_id"),
            "user_id": payload.get("user_id"),
        }
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
