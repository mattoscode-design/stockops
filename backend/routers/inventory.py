"""
Inventory Router — CRUD de itens de estoque persistido no Supabase.
Todos os endpoints exigem JWT válido. tenant_id é extraído do token.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends, Request, status
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
def list_inventory(request: Request, current_user: dict = Depends(get_current_user)):
    """Lista todos os itens de estoque do tenant autenticado."""
    tenant_id = _require_tenant(current_user)
    try:
        result = (
            supabase.table("inventory_items")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("sku")
            .execute()
        )
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
