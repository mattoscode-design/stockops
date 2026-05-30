"""
Inventories Router — Gestão de inventários nomeados por tenant.
Cada tenant pode ter múltiplos inventários (ex: "Estoque Principal", "Filial Norte").
Todos os endpoints exigem JWT válido. tenant_id é extraído do token.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends, Request, status
from middleware.auth import get_current_user
from middleware.rate_limit import limiter
from db.supabase_client import supabase
from models.schemas import InventoryCreate, InventoryResponse

logger = logging.getLogger("stockops.inventories")

router = APIRouter(prefix="/inventories", tags=["inventories"])


def _require_tenant(current_user: dict) -> str:
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sem tenant_id — faça login novamente",
        )
    return tenant_id


@router.get("", response_model=list[InventoryResponse])
@limiter.limit("30/minute")
def list_inventories(request: Request, current_user: dict = Depends(get_current_user)):
    """Lista todos os inventários do tenant autenticado, ordenados por data de criação."""
    tenant_id = _require_tenant(current_user)
    try:
        result = (
            supabase.table("inventories")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("created_at")
            .execute()
        )
        return result.data
    except Exception as e:
        logger.error(f"Erro ao listar inventários: {e}")
        raise HTTPException(status_code=500, detail="Erro ao consultar inventários")


@router.post("", response_model=InventoryResponse, status_code=201)
@limiter.limit("30/minute")
def create_inventory(
    request: Request,
    inventory: InventoryCreate,
    current_user: dict = Depends(get_current_user),
):
    """Cria novo inventário para o tenant. Nomes devem ser únicos por tenant."""
    tenant_id = _require_tenant(current_user)
    data = inventory.model_dump()
    data["tenant_id"] = tenant_id
    data["active"] = False
    try:
        result = supabase.table("inventories").insert(data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Erro ao criar inventário")
        logger.info(f"Inventário criado: '{inventory.name}' (tenant={tenant_id})")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao criar inventário: {e}")
        raise HTTPException(status_code=500, detail="Erro ao criar inventário")


@router.delete("/{inventory_id}", status_code=204)
@limiter.limit("30/minute")
def delete_inventory(
    request: Request,
    inventory_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Remove inventário. Retorna 404 se não pertencer ao tenant.
    Retorna 409 se houver itens vinculados — mova os itens antes de deletar."""
    tenant_id = _require_tenant(current_user)
    try:
        existing = (
            supabase.table("inventories")
            .select("id")
            .eq("id", inventory_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")

        # Bloqueia delete se ainda houver itens vinculados
        items = (
            supabase.table("inventory_items")
            .select("id")
            .eq("inventory_id", inventory_id)
            .limit(1)
            .execute()
        )
        if items.data:
            raise HTTPException(
                status_code=409,
                detail="Inventário possui itens vinculados. Remova ou mova os itens antes de deletar.",
            )

        supabase.table("inventories").delete().eq("id", inventory_id).execute()
        logger.info(f"Inventário removido: {inventory_id} (tenant={tenant_id})")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao remover inventário {inventory_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao remover inventário")


@router.post("/{inventory_id}/activate", response_model=InventoryResponse)
@limiter.limit("30/minute")
def activate_inventory(
    request: Request,
    inventory_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Define o inventário como ativo. Desativa todos os outros do tenant automaticamente."""
    tenant_id = _require_tenant(current_user)
    try:
        existing = (
            supabase.table("inventories")
            .select("id")
            .eq("id", inventory_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Inventário não encontrado")

        # Desativa todos os inventários do tenant
        supabase.table("inventories").update({"active": False}).eq("tenant_id", tenant_id).execute()

        # Ativa o inventário selecionado
        result = (
            supabase.table("inventories")
            .update({"active": True})
            .eq("id", inventory_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=500, detail="Erro ao ativar inventário")

        logger.info(f"Inventário ativado: {inventory_id} (tenant={tenant_id})")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao ativar inventário {inventory_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao ativar inventário")
