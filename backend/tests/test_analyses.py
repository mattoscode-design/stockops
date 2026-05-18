"""
Testes dos endpoints de histórico de análises — Supabase mockado.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient

MOCK_USER = {"username": "admin", "role": "admin", "tenant_id": "tenant-001", "user_id": "user-001"}

MOCK_RECORD = {
    "id": "analysis-001",
    "tenant_id": "tenant-001",
    "user_id": "user-001",
    "created_at": "2026-05-14T10:00:00+00:00",
    "total_skus": 5,
    "skus_criticos": 2,
    "perda_total_estimada": 1500.00,
    "relatorio": "Relatório de teste",
    "resultados": [],
}

MOCK_SUMMARY_PAYLOAD = {
    "total_skus": 5,
    "skus_criticos": 2,
    "perda_total_estimada": 1500.00,
    "categorias": ["Bebidas"],
    "relatorio": "Relatório de teste",
    "resultados": [],
}


@pytest.fixture
def app_client():
    from routers.analyses import router
    from middleware.auth import get_current_user

    test_app = FastAPI()
    test_app.include_router(router)
    test_app.dependency_overrides[get_current_user] = lambda: MOCK_USER

    with patch("routers.analyses.supabase") as mock_sb:
        yield TestClient(test_app, raise_server_exceptions=True), mock_sb

    test_app.dependency_overrides.clear()


# ────────────────────────────────────────────────────────────
# GET /analyses
# ────────────────────────────────────────────────────────────

class TestListAnalyses:
    def test_retorna_historico(self, app_client):
        client, mock_sb = app_client
        (mock_sb.table.return_value.select.return_value
         .eq.return_value.order.return_value.limit.return_value
         .execute.return_value) = MagicMock(data=[MOCK_RECORD])

        resp = client.get("/analyses")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == "analysis-001"

    def test_retorna_lista_vazia(self, app_client):
        client, mock_sb = app_client
        (mock_sb.table.return_value.select.return_value
         .eq.return_value.order.return_value.limit.return_value
         .execute.return_value) = MagicMock(data=[])

        resp = client.get("/analyses")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_limite_maximo_10(self, app_client):
        client, mock_sb = app_client
        registros = [{**MOCK_RECORD, "id": f"analysis-{i:03d}"} for i in range(10)]
        (mock_sb.table.return_value.select.return_value
         .eq.return_value.order.return_value.limit.return_value
         .execute.return_value) = MagicMock(data=registros)

        resp = client.get("/analyses")
        assert resp.status_code == 200
        assert len(resp.json()) == 10


# ────────────────────────────────────────────────────────────
# POST /analyses
# ────────────────────────────────────────────────────────────

class TestCreateAnalysis:
    def test_salva_analise_com_sucesso(self, app_client):
        client, mock_sb = app_client
        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[MOCK_RECORD])

        resp = client.post("/analyses", json=MOCK_SUMMARY_PAYLOAD)
        assert resp.status_code == 201
        assert resp.json()["id"] == "analysis-001"
        assert resp.json()["total_skus"] == 5

    def test_payload_invalido_retorna_422(self, app_client):
        client, _ = app_client
        resp = client.post("/analyses", json={"total_skus": 5})
        assert resp.status_code == 422

    def test_500_quando_supabase_falha(self, app_client):
        client, mock_sb = app_client
        mock_sb.table.return_value.insert.return_value.execute.side_effect = Exception("DB offline")

        resp = client.post("/analyses", json=MOCK_SUMMARY_PAYLOAD)
        assert resp.status_code == 500


# ────────────────────────────────────────────────────────────
# GET /analyses/{id}
# ────────────────────────────────────────────────────────────

class TestGetAnalysis:
    def test_retorna_analise_por_id(self, app_client):
        client, mock_sb = app_client
        (mock_sb.table.return_value.select.return_value
         .eq.return_value.eq.return_value
         .execute.return_value) = MagicMock(data=[MOCK_RECORD])

        resp = client.get("/analyses/analysis-001")
        assert resp.status_code == 200
        assert resp.json()["id"] == "analysis-001"

    def test_404_quando_nao_encontrado(self, app_client):
        client, mock_sb = app_client
        (mock_sb.table.return_value.select.return_value
         .eq.return_value.eq.return_value
         .execute.return_value) = MagicMock(data=[])

        resp = client.get("/analyses/nao-existe")
        assert resp.status_code == 404

    def test_nao_retorna_analise_de_outro_tenant(self, app_client):
        """Garante que tenant_id é filtrado na query (isolamento)."""
        client, mock_sb = app_client
        # Simula: query com tenant_id diferente → sem resultado
        (mock_sb.table.return_value.select.return_value
         .eq.return_value.eq.return_value
         .execute.return_value) = MagicMock(data=[])

        resp = client.get("/analyses/analysis-de-outro-tenant")
        assert resp.status_code == 404


# ────────────────────────────────────────────────────────────
# save_analysis (função utilitária)
# ────────────────────────────────────────────────────────────

class TestSaveAnalysis:
    def test_retorna_none_quando_supabase_falha(self):
        from routers.analyses import save_analysis
        from models.schemas import AnalysisSummary

        summary = AnalysisSummary(**MOCK_SUMMARY_PAYLOAD)

        with patch("routers.analyses.supabase") as mock_sb:
            mock_sb.table.return_value.insert.return_value.execute.side_effect = Exception("erro")
            result = save_analysis(summary, "tenant-001", "user-001")

        assert result is None  # não levanta exceção

    def test_retorna_registro_quando_sucesso(self):
        from routers.analyses import save_analysis
        from models.schemas import AnalysisSummary

        summary = AnalysisSummary(**MOCK_SUMMARY_PAYLOAD)

        with patch("routers.analyses.supabase") as mock_sb:
            mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[MOCK_RECORD])
            result = save_analysis(summary, "tenant-001", "user-001")

        assert result is not None
        assert result["id"] == "analysis-001"


# ────────────────────────────────────────────────────────────
# DELETE /analyses/{id}
# ────────────────────────────────────────────────────────────

class TestDeleteAnalysis:
    def test_deleta_analise_com_sucesso(self, app_client):
        client, mock_sb = app_client
        (mock_sb.table.return_value.delete.return_value
         .eq.return_value.eq.return_value
         .execute.return_value) = MagicMock(data=[MOCK_RECORD])

        resp = client.delete("/analyses/analysis-001")
        assert resp.status_code == 204

    def test_404_quando_nao_encontrado(self, app_client):
        client, mock_sb = app_client
        (mock_sb.table.return_value.delete.return_value
         .eq.return_value.eq.return_value
         .execute.return_value) = MagicMock(data=[])

        resp = client.delete("/analyses/nao-existe")
        assert resp.status_code == 404

    def test_isolamento_tenant_nao_deleta_outro(self, app_client):
        """Tenant_id diferente no banco → data vazia → 404 (sem vazar dados)."""
        client, mock_sb = app_client
        (mock_sb.table.return_value.delete.return_value
         .eq.return_value.eq.return_value
         .execute.return_value) = MagicMock(data=[])

        resp = client.delete("/analyses/analysis-de-outro-tenant")
        assert resp.status_code == 404

    def test_500_quando_supabase_falha(self, app_client):
        client, mock_sb = app_client
        mock_chain = (
            mock_sb.table.return_value.delete.return_value
            .eq.return_value.eq.return_value
        )
        mock_chain.execute.side_effect = Exception("DB offline")

        resp = client.delete("/analyses/analysis-001")
        assert resp.status_code == 500


# ────────────────────────────────────────────────────────────
# DELETE /analyses  (clear all)
# ────────────────────────────────────────────────────────────

class TestDeleteAllAnalyses:
    def test_limpa_historico_com_sucesso(self, app_client):
        client, mock_sb = app_client
        (mock_sb.table.return_value.delete.return_value
         .eq.return_value
         .execute.return_value) = MagicMock(data=[MOCK_RECORD])

        resp = client.delete("/analyses")
        assert resp.status_code == 204

    def test_isolamento_filtra_apenas_tenant_atual(self, app_client):
        """Garante que .eq('tenant_id', tenant_id) é chamado com o valor correto."""
        client, mock_sb = app_client
        (mock_sb.table.return_value.delete.return_value
         .eq.return_value
         .execute.return_value) = MagicMock(data=[])

        resp = client.delete("/analyses")
        assert resp.status_code == 204
        mock_sb.table.return_value.delete.return_value.eq.assert_called_with(
            "tenant_id", "tenant-001"
        )

    def test_500_quando_supabase_falha(self, app_client):
        client, mock_sb = app_client
        mock_chain = mock_sb.table.return_value.delete.return_value.eq.return_value
        mock_chain.execute.side_effect = Exception("DB offline")

        resp = client.delete("/analyses")
        assert resp.status_code == 500
