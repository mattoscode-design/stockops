"""
Inventory Router — CRUD de itens de estoque persistido no Supabase.
Todos os endpoints exigem JWT válido. tenant_id é extraído do token.
"""

import logging
from datetime import date

import pandas as pd

from fastapi import APIRouter, HTTPException, Depends, Request, Query, status
from middleware.auth import get_current_user
from middleware.rate_limit import limiter
from db.supabase_client import supabase
from models.schemas import InventoryItemCreate, InventoryItemUpdate, MovementCreate

logger = logging.getLogger("stockops.inventory")

router = APIRouter(prefix="/inventory", tags=["inventory"])


def _require_tenant(current_user: dict) -> str:
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sem tenant_id — faça login novamente",
        )
    return tenant_id


@router.get("")
@limiter.limit("30/minute")
def list_inventory(
    request: Request,
    inventory_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Lista itens de estoque do tenant. Aceita ?inventory_id= para filtrar por inventário específico."""
    tenant_id = _require_tenant(current_user)
    try:
        query = supabase.table("inventory_items").select("*").eq("tenant_id", tenant_id)
        if inventory_id:
            query = query.eq("inventory_id", inventory_id)
        result = query.order("sku").execute()
        return result.data
    except Exception as e:
        logger.error(f"Erro ao listar inventário: {e}")
        raise HTTPException(status_code=500, detail="Erro ao consultar inventário")


@router.post("", status_code=201)
@limiter.limit("30/minute")
def create_item(
    request: Request,
    item: InventoryItemCreate,
    current_user: dict = Depends(get_current_user),
):
    """Cria novo item de estoque para o tenant autenticado."""
    tenant_id = _require_tenant(current_user)
    data = item.model_dump()
    data["tenant_id"] = tenant_id
    try:
        result = supabase.table("inventory_items").insert(data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Erro ao criar item")
        logger.info(f"Item criado: {item.sku} / {item.loja} (tenant={tenant_id})")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao criar item: {e}")
        raise HTTPException(status_code=500, detail="Erro ao criar item")


@router.get("/projection")
@limiter.limit("30/minute")
def get_projection(
    request: Request,
    inventory_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """
    Retorna projeção financeira do estoque do tenant.

    Campos retornados:
      receita_potencial_total    soma(estoque_atual * preco_medio)
      receita_projetada_7d       soma(vendas_diarias * preco_medio * 7)
      receita_projetada_30d      soma(vendas_diarias * preco_medio * 30)
      perda_por_vencimento       soma das perdas de SKUs com data_validade dentro da cobertura
      receita_liquida_projetada  receita_projetada_30d - perda_por_vencimento
    """
    tenant_id = _require_tenant(current_user)
    try:
        query = (
            supabase.table("inventory_items")
            .select("estoque_atual, vendas_diarias, preco_medio, data_validade")
            .eq("tenant_id", tenant_id)
        )
        if inventory_id:
            query = query.eq("inventory_id", inventory_id)
        result = query.execute()
    except Exception as e:
        logger.error(f"Erro ao buscar itens para projeção: {e}")
        raise HTTPException(status_code=500, detail="Erro ao calcular projeção")

    items = result.data or []
    hoje = date.today()

    receita_potencial_total = 0.0
    receita_projetada_7d = 0.0
    receita_projetada_30d = 0.0
    perda_por_vencimento = 0.0

    for item in items:
        estoque = float(item.get("estoque_atual") or 0)
        vendas = float(item.get("vendas_diarias") or 0)
        preco = float(item.get("preco_medio") or 0)

        receita_potencial_total += estoque * preco
        receita_projetada_7d += vendas * preco * 7
        receita_projetada_30d += vendas * preco * 30

        # Perda por vencimento: quando cobertura > dias até vencer
        data_val_raw = item.get("data_validade")
        if data_val_raw:
            try:
                if isinstance(data_val_raw, str):
                    dt = pd.to_datetime(data_val_raw).date()
                elif isinstance(data_val_raw, date):
                    dt = data_val_raw
                else:
                    dt = pd.to_datetime(data_val_raw).date()
                dias_ate_vencer = (dt - hoje).days
                if dias_ate_vencer > 0 and vendas > 0:
                    cobertura = estoque / vendas
                    if cobertura > dias_ate_vencer:
                        unidades_perdidas = estoque - vendas * dias_ate_vencer
                        perda_por_vencimento += max(0.0, unidades_perdidas) * preco
            except Exception:
                pass  # data_validade inválida — ignora sem quebrar

    return {
        "receita_potencial_total": round(receita_potencial_total, 2),
        "receita_projetada_7d": round(receita_projetada_7d, 2),
        "receita_projetada_30d": round(receita_projetada_30d, 2),
        "perda_por_vencimento": round(perda_por_vencimento, 2),
        "receita_liquida_projetada": round(receita_projetada_30d - perda_por_vencimento, 2),
    }


@router.put("/{item_id}")
@limiter.limit("30/minute")
def update_item(
    request: Request,
    item_id: str,
    item: InventoryItemUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Atualiza item de estoque. Retorna 404 se item não pertencer ao tenant."""
    tenant_id = _require_tenant(current_user)
    try:
        existing = (
            supabase.table("inventory_items")
            .select("id")
            .eq("id", item_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Item não encontrado")

        data = item.model_dump(exclude_unset=True)
        if not data:
            raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")

        result = (
            supabase.table("inventory_items")
            .update(data)
            .eq("id", item_id)
            .execute()
        )
        logger.info(f"Item atualizado: {item_id} (tenant={tenant_id})")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao atualizar item {item_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao atualizar item")


@router.get("/{item_id}/movements")
@limiter.limit("30/minute")
def list_movements(
    request: Request,
    item_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Lista todos os movimentos de um item. Verifica que o item pertence ao tenant antes de retornar."""
    tenant_id = _require_tenant(current_user)
    try:
        # Verifica ownership antes de expor movimentos
        existing = (
            supabase.table("inventory_items")
            .select("id")
            .eq("id", item_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Item não encontrado")

        result = (
            supabase.table("inventory_movements")
            .select("*")
            .eq("item_id", item_id)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao listar movimentos do item {item_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao consultar movimentos")


@router.delete("/{item_id}", status_code=204)
@limiter.limit("30/minute")
def delete_item(
    request: Request,
    item_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Remove item e todos os seus movimentos. Retorna 404 se não pertencer ao tenant."""
    tenant_id = _require_tenant(current_user)
    try:
        existing = (
            supabase.table("inventory_items")
            .select("id")
            .eq("id", item_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Item não encontrado")

        # Remove movimentos primeiro (sem ON DELETE CASCADE no schema)
        supabase.table("inventory_movements").delete().eq("item_id", item_id).execute()

        supabase.table("inventory_items").delete().eq("id", item_id).execute()
        logger.info(f"Item removido: {item_id} (tenant={tenant_id})")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao remover item {item_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao remover item")


@router.post("/{item_id}/movement", status_code=201)
@limiter.limit("30/minute")
def register_movement(
    request: Request,
    item_id: str,
    movement: MovementCreate,
    current_user: dict = Depends(get_current_user),
):
    """Registra movimento de entrada ou saída para um item do tenant."""
    tenant_id = _require_tenant(current_user)
    try:
        existing = (
            supabase.table("inventory_items")
            .select("id")
            .eq("id", item_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Item não encontrado")

        data = movement.model_dump()
        data["tenant_id"] = tenant_id
        data["item_id"] = item_id
        result = supabase.table("inventory_movements").insert(data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Erro ao registrar movimento")
        logger.info(
            f"Movimento registrado: {movement.tipo} {movement.quantidade} "
            f"(item={item_id}, tenant={tenant_id})"
        )
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao registrar movimento para {item_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao registrar movimento")
