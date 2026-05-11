from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from middleware.auth import get_current_user
from middleware.rate_limit import limiter
from models.schemas import AnalysisSummary
from services.chat_service import responder

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    question: str
    context: AnalysisSummary


class ChatResponse(BaseModel):
    answer: str


@router.post("/message", response_model=ChatResponse)
@limiter.limit("20/minute")
async def message(
    request: Request,
    payload: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    answer = responder(payload.question, payload.context.model_dump())
    return ChatResponse(answer=answer)
