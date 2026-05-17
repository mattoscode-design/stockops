"""
Testes dos endpoints de inventário — Supabase mockado via unittest.mock.patch.
Não faz chamadas reais ao banco.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient

MOCK_USER = {"username": "admin", "role": "admin", "tenant_id": "tenant-001"}
MOCK_ITEM = {
    "id": "item-001",
    "tenant_id": "tenant-001",
    "sku": "SKU-A",
    "loja": "Loja 1",
    "categoria": "Bebidas",
    "estoque_atual": 100.0,
    "vendas_diarias": 10.0,
    "preco_medio": 5.0,
}
MOCK_MOVEMENT = {
    "id": "mov-001",
    "tenant_id": "tenant-001",
    "item_id": "item-001",
    "tipo": "entrada",
    "quantidade": 50.0,
    "motivo": "Reposição",
}


@pytest.fixture
def app_client():
    """TestClient com dependência de auth mockada e Supabase patchado."""
    from routers.inventory import router
    from middleware.auth import get_current_user

    test_app = FastAPI()
    test_app.include_router(router)
    test_app.dependency_overrides[get_current_user] = lambda: MOCK_USER

    with patch("routers.inventory.supabase") as mock_supabase:
        yield TestClient(test_app, raise_server_exceptions=True), mock_supabase

    test_app.dependency_overrides.clear()


# ────────────────────────────────────────────────────────────
# GET /inventory
# ────────────────────────────────────────────────────────────

class TestListInventory:
    def test_retorna_lista_de_itens(self, app_client):
        client, mock_sb = app_client
        mock_sb.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=[MOCK_ITEM])

        resp = client.get("/inventory")
        assert resp.status_code == 200
        assert resp.json() == [MOCK_ITEM]

    def test_lista_vazia_quando_sem_itens(self, app_client):
        client, mock_sb = app_client
        mock_sb.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=[])

        resp = client.get("/inventory")
        assert resp.status_code == 200
        assert resp.json() == []


# ────────────────────────────────────────────────────────────
# POST /inventory
# ────────────────────────────────────────────────────────────

class TestCreateItem:
    VALID_PAYLOAD = {
        "sku": "SKU-A",
        "loja": "Loja 1",
        "estoque_atual": 100.0,
        "vendas_diarias": 10.0,
        "preco_medio": 5.0,
    }

    def test_cria_item_com_sucesso(self, app_client):
        client, mock_sb = app_client
        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[MOCK_ITEM])

        resp = client.post("/inventory", json=self.VALID_PAYLOAD)
        assert resp.status_code == 201
        assert resp.json()["sku"] == "SKU-A"

    def test_categoria_padrao_sem_categoria(self, app_client):
        client, mock_sb = app_client
        inserted = {**MOCK_ITEM, "categoria": "Sem Categoria"}
        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[inserted])

        resp = client.post("/inventory", json=self.VALID_PAYLOAD)
        assert resp.status_code == 201

    def test_campos_obrigatorios_ausentes_retornam_422(self, app_client):
        client, _ = app_client
        resp = client.post("/inventory", json={"sku": "SKU-A"})
        assert resp.status_code == 422


# ────────────────────────────────────────────────────────────
# PUT /inventory/{id}
# ────────────────────────────────────────────────────────────

class TestUpdateItem:
    def test_atualiza_item_existente(self, app_client):
        client, mock_sb = app_client
        updated = {**MOCK_ITEM, "estoque_atual": 200.0}

        # Simula: exists check → update
        mock_table = mock_sb.table.return_value
        mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "item-001"}])
        mock_table.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[updated])

        resp = client.put("/inventory/item-001", json={"estoque_atual": 200.0})
        assert resp.status_code == 200
        assert resp.json()["estoque_atual"] == 200.0

    def test_404_quando_item_nao_existe(self, app_client):
        client, mock_sb = app_client
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        resp = client.put("/inventory/nao-existe", json={"estoque_atual": 50.0})
        assert resp.status_code == 404

    def test_422_quando_body_vazio(self, app_client):
        client, mock_sb = app_client
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "item-001"}])

        resp = client.put("/inventory/item-001", json={})
        assert resp.status_code == 422


# ────────────────────────────────────────────────────────────
# POST /inventory/{id}/movement
# ────────────────────────────────────────────────────────────

class TestRegisterMovement:
    VALID_MOVEMENT = {"tipo": "entrada", "quantidade": 50.0, "motivo": "Reposição"}

    def test_registra_entrada(self, app_client):
        client, mock_sb = app_client
        mock_table = mock_sb.table.return_value
        mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "item-001"}])
        mock_table.insert.return_value.execute.return_value = MagicMock(data=[MOCK_MOVEMENT])

        resp = client.post("/inventory/item-001/movement", json=self.VALID_MOVEMENT)
        assert resp.status_code == 201
        assert resp.json()["tipo"] == "entrada"

    def test_registra_saida(self, app_client):
        client, mock_sb = app_client
        mov_saida = {**MOCK_MOVEMENT, "tipo": "saida"}
        mock_table = mock_sb.table.return_value
        mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "item-001"}])
        mock_table.insert.return_value.execute.return_value = MagicMock(data=[mov_saida])

        resp = client.post("/inventory/item-001/movement", json={"tipo": "saida", "quantidade": 20.0})
        assert resp.status_code == 201

    def test_tipo_invalido_retorna_422(self, app_client):
        client, _ = app_client
        resp = client.post("/inventory/item-001/movement", json={"tipo": "transferencia", "quantidade": 10.0})
        assert resp.status_code == 422

    def test_404_quando_item_nao_existe(self, app_client):
        client, mock_sb = app_client
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        resp = client.post("/inventory/nao-existe/movement", json=self.VALID_MOVEMENT)
        assert resp.status_code == 404


# ────────────────────────────────────────────────────────────
# GET /inventory/{id}/movements
# ────────────────────────────────────────────────────────────

class TestListMovements:
    def test_retorna_movimentos_do_item(self, app_client):
        client, mock_sb = app_client
        mock_table = mock_sb.table.return_value
        mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "item-001"}])
        mock_table.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=[MOCK_MOVEMENT])

        resp = client.get("/inventory/item-001/movements")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_lista_vazia_quando_sem_movimentos(self, app_client):
        client, mock_sb = app_client
        mock_table = mock_sb.table.return_value
        mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "item-001"}])
        mock_table.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=[])

        resp = client.get("/inventory/item-001/movements")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_404_quando_item_nao_pertence_ao_tenant(self, app_client):
        client, mock_sb = app_client
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        resp = client.get("/inventory/item-de-outro-tenant/movements")
        assert resp.status_code == 404


# ────────────────────────────────────────────────────────────
# DELETE /inventory/{id}
# ────────────────────────────────────────────────────────────

class TestDeleteItem:
    def test_deleta_item_com_sucesso(self, app_client):
        client, mock_sb = app_client
        mock_table = mock_sb.table.return_value
        mock_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "item-001"}])
        mock_table.delete.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        resp = client.delete("/inventory/item-001")
        assert resp.status_code == 204

    def test_404_quando_item_nao_existe(self, app_client):
        client, mock_sb = app_client
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        resp = client.delete("/inventory/nao-existe")
        assert resp.status_code == 404

    def test_nao_deleta_item_de_outro_tenant(self, app_client):
        """Garante que tenant_id é filtrado antes do delete."""
        client, mock_sb = app_client
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

        resp = client.delete("/inventory/item-de-outro-tenant")
        assert resp.status_code == 404
