from fastapi import APIRouter, HTTPException, status
from models.schemas import Token, UserLogin
from middleware.auth import USERS, verify_password, create_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(data: UserLogin):
    user = USERS.get(data.username)
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas")
    token = create_token({"sub": data.username, "role": user["role"]})
    return {"access_token": token, "token_type": "bearer"}
