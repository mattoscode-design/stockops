"""
Testes dos endpoints de inventários — Supabase mockado via unittest.mock.patch.
Não faz chamadas reais ao banco.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient

MOCK_USER = {"username": "admin", "role": "admin", "tenant_id": "tenant-001"}

MOCK_INVENTORY = {
    "id": "inv-001",
    "tenant_id": "tenant-001",
    "name": "Estoque Principal",
    "description": "Inventário padrão",
    "active": True,
    "created_at": "2026-05-22T10:00:00+00:00",
}

MOCK_INVENTORY_INACTIVE = {**MOCK_INVENTORY, "id": "inv-002", "name": "Filial Norte", "active": False}


@pytest.fixture
def app_client():
    """TestClient com dependência de auth mockada e Supabase patchado."""
    from routers.inventories import router
    from middleware.auth import get_current_user

    test_app = FastAPI()
    test_app.include_router(router)
    test_app.dependency_overrides[get_current_user] = lambda: MOCK_USER

    with patch("routers.inventories.supabase") as mock_sb:
        yield TestClient(test_app, raise_server_exceptions=True), mock_sb

    test_app.dependency_overrides.clear()


# ────────────────────────────────────────────────────────────
# GET /inventories
# ────────────────────────────────────────────────────────────

class TestListInventories:
    def test_retorna_lista_de_inventarios(self, app_client):
        client, mock_sb = app_client
        (mock_sb.table.return_value.select.return_value
         .eq.return_value.order.return_value
         .execute.return_value) = MagicMock(data=[MOCK_INVENTORY])

        resp = client.get("/inventories")
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["name"] == "Estoque Principal"

    def test_lista_vazia_quando_sem_inventarios(self, app_client):
        client, mock_sb = app_client
        (mock_sb.table.return_value.select.return_value
         .eq.return_value.order.return_value
         .execute.return_value) = MagicMock(data=[])

        resp = client.get("/inventories")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_500_quando_supabase_falha(self, app_client):
        client, mock_sb = app_client
        (mock_sb.table.return_value.select.return_value
         .eq.return_value.order.return_value
         .execute.side_effect) = Exception("DB offline")

        resp = client.get("/inventories")
        assert resp.status_code == 500


# ────────────────────────────────────────────────────────────
# POST /inventories
# ────────────────────────────────────────────────────────────

class TestCreateInventory:
    VALID_PAYLOAD = {"name": "Filial Sul"}

    def test_cria_inventario_com_sucesso(self, app_client):
        client, mock_sb = app_client
        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[MOCK_INVENTORY_INACTIVE])

        resp = client.post("/inventories", json=self.VALID_PAYLOAD)
        assert resp.status_code == 201
        assert resp.json()["name"] == "Filial Norte"
        assert resp.json()["active"] is False

    def test_cria_com_descricao_opcional(self, app_client):
        client, mock_sb = app_client
        with_desc = {**MOCK_INVENTORY_INACTIVE, "description": "Filial ao Norte da cidade"}
        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[with_desc])

        resp = client.post("/inventories", json={"name": "Filial Norte", "description": "Filial ao Norte da cidade"})
        assert resp.status_code == 201
        assert resp.json()["description"] == "Filial ao Norte da cidade"

    def test_nome_vazio_retorna_422(self, app_client):
        client, _ = app_client
        resp = client.post("/inventories", json={"name": "   "})
        assert resp.status_code == 422

    def test_sem_nome_retorna_422(self, app_client):
        client, _ = app_client
        resp = client.post("/inventories", json={})
        assert resp.status_code == 422

    def test_500_quando_supabase_falha(self, app_client):
        client, mock_sb = app_client
        mock_sb.table.return_value.insert.return_value.execute.side_effect = Exception("DB offline")

        resp = client.post("/inventories", json=self.VALID_PAYLOAD)
        assert resp.status_code == 500


# ────────────────────────────────────────────────────────────
# DELETE /inventories/{id}
# ────────────────────────────────────────────────────────────

class TestDeleteInventory:
    def test_deleta_inventario_sem_itens(self, app_client):
        client, mock_sb = app_client
        mock_table = mock_sb.table.return_value
        # Ownership check → encontrado
        mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "inv-001"}])
        # Items check → nenhum item vinculado
        mock_table.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
        # Delete
        mock_table.delete.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        resp = client.delete("/inventories/inv-001")
        assert resp.status_code == 204

    def test_404_quando_inventario_nao_existe(self, app_client):
        client, mock_sb = app_client
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        resp = client.delete("/inventories/nao-existe")
        assert resp.status_code == 404

    def test_404_quando_inventario_de_outro_tenant(self, app_client):
        """tenant_id filtrado na query → data vazia → 404."""
        client, mock_sb = app_client
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        resp = client.delete("/inventories/inv-de-outro-tenant")
        assert resp.status_code == 404

    def test_409_quando_ha_itens_vinculados(self, app_client):
        client, mock_sb = app_client
        mock_table = mock_sb.table.return_value
        # Ownership check → encontrado
        mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "inv-001"}])
        # Items check → há itens
        mock_table.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[{"id": "item-001"}])

        resp = client.delete("/inventories/inv-001")
        assert resp.status_code == 409
        assert "itens vinculados" in resp.json()["detail"]


# ────────────────────────────────────────────────────────────
# POST /inventories/{id}/activate
# ────────────────────────────────────────────────────────────

class TestActivateInventory:
    def test_ativa_inventario_com_sucesso(self, app_client):
        client, mock_sb = app_client
        mock_table = mock_sb.table.return_value
        # Ownership check → encontrado
        mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "inv-001"}])
        # update → eq → execute (usado em desativar-todos e ativar-específico)
        mock_table.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[MOCK_INVENTORY])

        resp = client.post("/inventories/inv-001/activate")
        assert resp.status_code == 200
        assert resp.json()["active"] is True

    def test_404_quando_inventario_nao_existe(self, app_client):
        client, mock_sb = app_client
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        resp = client.post("/inventories/nao-existe/activate")
        assert resp.status_code == 404

    def test_404_quando_inventario_de_outro_tenant(self, app_client):
        client, mock_sb = app_client
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        resp = client.post("/inventories/inv-de-outro-tenant/activate")
        assert resp.status_code == 404

    def test_desativa_todos_antes_de_ativar(self, app_client):
        """Garante que update({'active': False}) é chamado com tenant_id antes de ativar."""
        client, mock_sb = app_client
        mock_table = mock_sb.table.return_value
        mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "inv-001"}])
        mock_table.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[MOCK_INVENTORY])

        resp = client.post("/inventories/inv-001/activate")
        assert resp.status_code == 200
        # update foi chamado duas vezes: desativar-todos e ativar-específico
        assert mock_table.update.call_count == 2
        first_call_args = mock_table.update.call_args_list[0][0][0]
        assert first_call_args == {"active": False}
        second_call_args = mock_table.update.call_args_list[1][0][0]
        assert second_call_args == {"active": True}
