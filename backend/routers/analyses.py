"""
Analyses Router — Histórico de análises persistido no Supabase.
Todos os endpoints exigem JWT válido. tenant_id extraído do token.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends, Request, status
from middleware.auth import get_current_user
from middleware.rate_limit import limiter
from db.supabase_client import supabase
from models.schemas import AnalysisSummary, AnalysisRecord

logger = logging.getLogger("stockops.analyses")

router = APIRouter(prefix="/analyses", tags=["analyses"])

HISTORY_LIMIT = 10


def _require_tenant(current_user: dict) -> str:
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sem tenant_id — faça login novamente",
        )
    return tenant_id


def save_analysis(summary: AnalysisSummary, tenant_id: str, user_id: str | None) -> dict | None:
    """
    Persiste AnalysisSummary na tabela analyses do Supabase.
    Retorna o registro salvo ou None se falhar (não deve interromper o pipeline).
    """
    try:
        data = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "total_skus": summary.total_skus,
            "skus_criticos": summary.skus_criticos,
            "perda_total_estimada": float(summary.perda_total_estimada),
            "relatorio": summary.relatorio,
            "resultados": [r.model_dump() for r in summary.resultados],
        }
        result = supabase.table("analyses").insert(data).execute()
        if result.data:
            logger.info(
                f"Análise salva: id={result.data[0]['id']} "
                f"({summary.total_skus} SKUs, tenant={tenant_id})"
            )
            return result.data[0]
    except Exception as e:
        logger.error(f"Erro ao salvar análise no banco: {e}")
    return None


@router.get("", response_model=list[AnalysisRecord])
@limiter.limit("30/minute")
def list_analyses(request: Request, current_user: dict = Depends(get_current_user)):
    """Lista as últimas 10 análises do tenant autenticado."""
    tenant_id = _require_tenant(current_user)
    try:
        result = (
            supabase.table("analyses")
            .select("id, tenant_id, user_id, created_at, total_skus, skus_criticos, perda_total_estimada, relatorio, resultados")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(HISTORY_LIMIT)
            .execute()
        )
        return result.data
    except Exception as e:
        logger.error(f"Erro ao listar análises: {e}")
        raise HTTPException(status_code=500, detail="Erro ao consultar histórico")


@router.post("", response_model=AnalysisRecord, status_code=201)
@limiter.limit("30/minute")
def create_analysis(
    request: Request,
    summary: AnalysisSummary,
    current_user: dict = Depends(get_current_user),
):
    """Salva manualmente um resultado de análise para o tenant autenticado."""
    tenant_id = _require_tenant(current_user)
    user_id = current_user.get("user_id")
    saved = save_analysis(summary, tenant_id, user_id)
    if not saved:
        raise HTTPException(status_code=500, detail="Erro ao salvar análise")
    return saved


@router.get("/{analysis_id}", response_model=AnalysisRecord)
@limiter.limit("30/minute")
def get_analysis(
    request: Request,
    analysis_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Busca análise específica por ID. Retorna 404 se não pertencer ao tenant."""
    tenant_id = _require_tenant(current_user)
    try:
        result = (
            supabase.table("analyses")
            .select("id, tenant_id, user_id, created_at, total_skus, skus_criticos, perda_total_estimada, relatorio, resultados")
            .eq("id", analysis_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Análise não encontrada")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar análise {analysis_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao buscar análise")


@router.delete("/{analysis_id}", status_code=204)
@limiter.limit("30/minute")
def delete_analysis(
    request: Request,
    analysis_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Remove análise por ID. Retorna 404 se não pertencer ao tenant."""
    tenant_id = _require_tenant(current_user)
    try:
        result = (
            supabase.table("analyses")
            .delete()
            .eq("id", analysis_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Análise não encontrada")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao deletar análise {analysis_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao deletar análise")


@router.delete("", status_code=204)
@limiter.limit("10/minute")
def delete_all_analyses(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Remove todas as análises do tenant autenticado."""
    tenant_id = _require_tenant(current_user)
    try:
        supabase.table("analyses").delete().eq("tenant_id", tenant_id).execute()
    except Exception as e:
        logger.error(f"Erro ao limpar histórico do tenant {tenant_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao limpar histórico")
