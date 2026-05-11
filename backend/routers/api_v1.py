"""
Endpoint público para integração com ERPs via JSON.
Distribuidoras com sistema próprio mandam dados direto, sem precisar exportar planilha.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator
from typing import Optional
from middleware.auth import get_current_user
from services.data_processor import calcular_cobertura, detectar_aceleracao, calcular_impacto
from services.ml_engine import calcular_score, aplicar_classificacao, calcular_curva_abc
from services.report_service import gerar_relatorio, gerar_insight_estatico
from models.schemas import AnalysisSummary, AnalysisResponse
import pandas as pd

router = APIRouter(prefix="/api/v1", tags=["ERP Integration"])


class SkuPayload(BaseModel):
    sku: str
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
    df = calcular_cobertura(df)
    df = detectar_aceleracao(df)
    df = calcular_impacto(df)
    df = calcular_score(df)
    df = aplicar_classificacao(df)
    df = calcular_curva_abc(df)

    resultados = []
    for row in df.to_dict("records"):
        insight, recomendacao = gerar_insight_estatico(
            classificacao=row["classificacao"],
            cobertura=row["cobertura_dias"],
            perda=row["perda_estimada_reais"],
            quantidade=row["quantidade_recomendada"],
        )
        resultados.append(AnalysisResponse(
            sku=str(row["sku"]),
            loja=str(row["loja"]),
            categoria=str(row.get("categoria", "Sem Categoria")),
            cobertura_dias=row["cobertura_dias"],
            score_ruptura=row["score_ruptura"],
            classificacao=row["classificacao"],
            curva_abc=str(row.get("curva_abc", "C")),
            perda_estimada_reais=row["perda_estimada_reais"],
            quantidade_recomendada=row["quantidade_recomendada"],
            insight=insight,
            recomendacao=recomendacao,
        ))

    criticos  = [r for r in resultados if r.score_ruptura >= 71]
    perda_total = sum(r.perda_estimada_reais for r in resultados)
    categorias  = sorted({r.categoria for r in resultados})
    resultados_sorted = sorted(resultados, key=lambda x: x.score_ruptura, reverse=True)

    summary_dict = {
        "total_skus": len(resultados),
        "skus_criticos": len(criticos),
        "perda_total_estimada": round(perda_total, 2),
        "categorias": categorias,
        "resultados": [r.model_dump() for r in resultados_sorted],
    }

    return AnalysisSummary(
        total_skus=len(resultados),
        skus_criticos=len(criticos),
        perda_total_estimada=round(perda_total, 2),
        categorias=categorias,
        relatorio=gerar_relatorio(summary_dict),
        resultados=resultados_sorted,
    )
