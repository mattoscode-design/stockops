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


def save_analysis(
    summary: AnalysisSummary,
    tenant_id: str,
    user_id: str | None,
    items_snapshot: list[dict] | None = None,
    inventory_id: str | None = None,
) -> dict | None:
    """
    Persiste AnalysisSummary na tabela analyses do Supabase via upsert.

    Lógica: se já existe uma análise para o tenant, atualiza o registro mais
    recente (mantendo o id). Caso contrário, insere um novo registro.
    O items_snapshot é preenchido com os itens reais de inventory_items; se
    inventory_id for fornecido, filtra apenas os itens daquele inventário.
    Se items_snapshot for passado explicitamente, bypassa a busca no banco.

    Retorna o registro salvo ou None se falhar (não interrompe o pipeline).
    """
    try:
        # Snapshot real: busca os itens do tenant, filtrando por inventory_id se fornecido.
        # items_snapshot explícito tem precedência (útil em testes e chamadas diretas).
        if items_snapshot is None:
            query = supabase.table("inventory_items").select("*").eq("tenant_id", tenant_id)
            if inventory_id:
                query = query.eq("inventory_id", inventory_id)
            inv_result = query.execute()
            snapshot = inv_result.data
        else:
            snapshot = items_snapshot

        data = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "total_skus": summary.total_skus,
            "skus_criticos": summary.skus_criticos,
            "perda_total_estimada": float(summary.perda_total_estimada),
            "relatorio": summary.relatorio,
            "resultados": [r.model_dump() for r in summary.resultados],
            "items_snapshot": snapshot,
        }

        # Upsert: atualiza o registro mais recente se já existir para este tenant
        existing = (
            supabase.table("analyses")
            .select("id")
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )

        if existing.data:
            update_data = {k: v for k, v in data.items() if k != "tenant_id"}
            result = (
                supabase.table("analyses")
                .update(update_data)
                .eq("id", existing.data[0]["id"])
                .execute()
            )
        else:
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


_SELECT_FIELDS = (
    "id, tenant_id, user_id, created_at, updated_at, "
    "total_skus, skus_criticos, perda_total_estimada, relatorio, resultados, items_snapshot"
)


@router.get("", response_model=list[AnalysisRecord])
@limiter.limit("30/minute")
def list_analyses(request: Request, current_user: dict = Depends(get_current_user)):
    """Lista as últimas 10 análises do tenant autenticado."""
    tenant_id = _require_tenant(current_user)
    try:
        result = (
            supabase.table("analyses")
            .select(_SELECT_FIELDS)
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


@router.get("/current", response_model=AnalysisRecord)
@limiter.limit("30/minute")
def get_current_analysis(request: Request, current_user: dict = Depends(get_current_user)):
    """Retorna a análise mais recente do tenant autenticado, incluindo o items_snapshot."""
    tenant_id = _require_tenant(current_user)
    try:
        result = (
            supabase.table("analyses")
            .select(_SELECT_FIELDS)
            .eq("tenant_id", tenant_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Nenhuma análise encontrada para este tenant")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar análise atual do tenant {tenant_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao buscar análise atual")


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
            .select(_SELECT_FIELDS)
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
