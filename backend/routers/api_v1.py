"""
Endpoint público para integração com ERPs via JSON.
Distribuidoras com sistema próprio mandam dados direto, sem precisar exportar planilha.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator
from typing import Optional
from middleware.auth import get_current_user
from services.pipeline_service import run_analysis_pipeline
from models.schemas import AnalysisSummary
import pandas as pd

router = APIRouter(prefix="/api/v1", tags=["ERP Integration"])


class SkuPayload(BaseModel):
    sku: str
    nome: Optional[str] = None
    loja: str
    categoria: Optional[str] = "Sem Categoria"
    estoque_atual: float
    vendas_diarias: float
    preco_medio: float
    promocao_planejada: Optional[float] = 0.0

    @field_validator("estoque_atual", "vendas_diarias", "preco_medio")
    @classmethod
    def positive(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Valor não pode ser negativo")
        return v


class ERPRequest(BaseModel):
    skus: list[SkuPayload]

    @field_validator("skus")
    @classmethod
    def not_empty(cls, v: list) -> list:
        if not v:
            raise ValueError("Lista de SKUs não pode ser vazia")
        if len(v) > 1000:
            raise ValueError("Máximo de 1000 SKUs por requisição")
        return v


@router.post("/analysis", response_model=AnalysisSummary, summary="Análise via JSON (ERP Integration)")
async def analyze_from_json(
    payload: ERPRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Endpoint para integração direta com ERPs e sistemas internos.
    Recebe lista de SKUs em JSON e retorna a análise completa.

    Substitui o upload de planilha — ideal para automação.
    """
    df = pd.DataFrame([s.model_dump() for s in payload.skus])
    return run_analysis_pipeline(df)
