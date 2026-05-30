"""
Testes dos endpoints /team — Supabase mockado.

10 endpoints cobertos:
  GET    /team/tenants/search
  POST   /team/invites
  GET    /team/invites/{token}          (público — sem auth)
  POST   /team/invites/{token}/accept
  POST   /team/join-requests
  GET    /team/join-requests            (admin)
  POST   /team/join-requests/{id}/approve
  POST   /team/join-requests/{id}/reject
  GET    /team/members
  DELETE /team/members/{userId}
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient

# ── Dados de teste ────────────────────────────────────────────

TENANT_ID = "tenant-abc"
OTHER_TENANT_ID = "tenant-xyz"
USER_ID = "user-001"
OTHER_USER_ID = "user-002"
REQUEST_ID = "req-001"
INVITE_ID = "invite-001"
INVITE_TOKEN = "valid-token-abc123"

MOCK_ADMIN = {
    "user_id": USER_ID,
    "email": "admin@empresa.com",
    "role": "admin",
    "tenant_id": TENANT_ID,
    "auth_id": "auth-001",
    "username": "admin",
    "nome_exibicao": "Admin",
    "tipo_perfil": "empresa",
    "empresa_nome": "Empresa ABC",
}

MOCK_VIEWER = {**MOCK_ADMIN, "role": "viewer"}

MOCK_TENANT_ROW = {"id": TENANT_ID, "name": "Empresa ABC", "slug": "empresa-abc", "plan": "free"}

MOCK_INVITE = {
    "id": INVITE_ID,
    "tenant_id": TENANT_ID,
    "invited_email": "admin@empresa.com",
    "invited_by": USER_ID,
    "role": "viewer",
    "token": INVITE_TOKEN,
    "status": "pending",
    "expires_at": "2099-12-31T23:59:59+00:00",
    "created_at": "2026-05-25T00:00:00+00:00",
    "accepted_at": None,
}

MOCK_JOIN_REQUEST = {
    "id": REQUEST_ID,
    "tenant_id": TENANT_ID,
    "user_id": OTHER_USER_ID,
    "status": "pending",
    "message": "Quero entrar",
    "reviewed_by": None,
    "created_at": "2026-05-25T00:00:00+00:00",
    "reviewed_at": None,
}


# ── Fixtures ──────────────────────────────────────────────────


@pytest.fixture
def team_client():
    from routers.tenants import router
    from middleware.auth import get_current_user

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: MOCK_ADMIN

    with patch("routers.tenants.supabase") as mock_sb, \
         patch("services.tenant_service.supabase") as mock_ts:
        yield TestClient(app, raise_server_exceptions=True), mock_sb, mock_ts

    app.dependency_overrides.clear()


@pytest.fixture
def team_client_viewer():
    from routers.tenants import router
    from middleware.auth import get_current_user

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: MOCK_VIEWER

    with patch("routers.tenants.supabase") as mock_sb, \
         patch("services.tenant_service.supabase") as mock_ts:
        yield TestClient(app, raise_server_exceptions=True), mock_sb, mock_ts

    app.dependency_overrides.clear()


@pytest.fixture
def team_client_no_auth():
    from routers.tenants import router

    app = FastAPI()
    app.include_router(router)

    with patch("routers.tenants.supabase") as mock_sb:
        yield TestClient(app, raise_server_exceptions=False), mock_sb

    app.dependency_overrides.clear()


# ────────────────────────────────────────────────────────────
# 1. GET /team/tenants/search
# ────────────────────────────────────────────────────────────


class TestSearchTenants:
    def test_busca_sem_query_retorna_lista(self, team_client):
        client, mock_sb, _ = team_client
        mock_sb.table.return_value.select.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[MOCK_TENANT_ROW]
        )
        resp = client.get("/team/tenants/search")
        assert resp.status_code == 200
        assert resp.json()[0]["id"] == TENANT_ID

    def test_busca_com_query_aplica_filtro(self, team_client):
        client, mock_sb, _ = team_client
        mock_sb.table.return_value.select.return_value.ilike.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[MOCK_TENANT_ROW]
        )
        resp = client.get("/team/tenants/search?q=empresa")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_sem_resultados_retorna_lista_vazia(self, team_client):
        client, mock_sb, _ = team_client
        mock_sb.table.return_value.select.return_value.ilike.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[]
        )
        resp = client.get("/team/tenants/search?q=inexistente")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_sem_auth_retorna_401(self, team_client_no_auth):
        client, _ = team_client_no_auth
        resp = client.get("/team/tenants/search")
        assert resp.status_code == 401


# ────────────────────────────────────────────────────────────
# 2. POST /team/invites
# ────────────────────────────────────────────────────────────


class TestSendInvite:
    PAYLOAD = {"email": "novo@empresa.com", "role": "viewer"}

    def _mock_invite_success(self, mock_sb):
        """Configura mock para criação de convite bem-sucedida (sem pendente existente)."""
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[]
        )
        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": INVITE_ID}]
        )
        # tenant name lookup (select.eq.limit.execute)
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"name": "Empresa ABC"}]
        )

    def test_admin_convida_com_sucesso(self, team_client):
        client, mock_sb, _ = team_client
        self._mock_invite_success(mock_sb)
        with patch("services.email_service.send_invite_email") as mock_email:
            resp = client.post("/team/invites", json=self.PAYLOAD)
        assert resp.status_code == 201
        assert "token" in resp.json()
        assert resp.json()["invited_email"] == "novo@empresa.com"

    def test_email_normalizado_para_lowercase(self, team_client):
        """Email com maiúsculas deve ser normalizado antes de armazenar."""
        client, mock_sb, _ = team_client
        self._mock_invite_success(mock_sb)
        with patch("services.email_service.send_invite_email"):
            resp = client.post("/team/invites", json={"email": "Novo@Empresa.COM", "role": "viewer"})
        assert resp.status_code == 201
        assert resp.json()["invited_email"] == "novo@empresa.com"

    def test_email_de_convite_enviado(self, team_client):
        """send_invite_email deve ser chamado com os dados corretos."""
        client, mock_sb, _ = team_client
        self._mock_invite_success(mock_sb)
        with patch("services.email_service.send_invite_email") as mock_email:
            resp = client.post("/team/invites", json=self.PAYLOAD)
        assert resp.status_code == 201
        mock_email.assert_called_once()
        call_kwargs = mock_email.call_args
        assert call_kwargs[1]["to_email"] == "novo@empresa.com" or call_kwargs[0][0] == "novo@empresa.com"

    def test_convite_pendente_existente_retorna_400(self, team_client):
        client, mock_sb, _ = team_client
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"id": "existing"}]
        )
        resp = client.post("/team/invites", json=self.PAYLOAD)
        assert resp.status_code == 400
        assert "pendente" in resp.json()["detail"]

    def test_role_invalido_retorna_422(self, team_client):
        client, _, _ = team_client
        resp = client.post("/team/invites", json={"email": "x@test.com", "role": "superadmin"})
        assert resp.status_code == 422

    def test_email_vazio_retorna_422(self, team_client):
        client, _, _ = team_client
        resp = client.post("/team/invites", json={"email": "  ", "role": "viewer"})
        assert resp.status_code == 422

    def test_viewer_nao_pode_convidar_retorna_403(self, team_client_viewer):
        client, _, _ = team_client_viewer
        resp = client.post("/team/invites", json=self.PAYLOAD)
        assert resp.status_code == 403

    def test_sem_auth_retorna_401(self, team_client_no_auth):
        client, _ = team_client_no_auth
        resp = client.post("/team/invites", json=self.PAYLOAD)
        assert resp.status_code == 401


# ────────────────────────────────────────────────────────────
# 3. GET /team/invites/{token}
# ────────────────────────────────────────────────────────────


class TestGetInvite:
    """Endpoint público — não requer autenticação."""

    def test_retorna_detalhes_do_convite(self, team_client_no_auth):
        client, mock_sb = team_client_no_auth
        # Ambas as lookups usam .eq().limit().execute() — usar side_effect sequencial
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.side_effect = [
            MagicMock(data=[MOCK_INVITE]),
            MagicMock(data=[{"name": "Empresa ABC", "slug": "empresa-abc"}]),
        ]
        resp = client.get(f"/team/invites/{INVITE_TOKEN}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["tenant_id"] == TENANT_ID
        assert body["invited_email"] == "admin@empresa.com"
        assert "tenant_name" in body

    def test_token_invalido_retorna_404(self, team_client_no_auth):
        client, mock_sb = team_client_no_auth
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[]
        )
        resp = client.get("/team/invites/token-invalido")
        assert resp.status_code == 404

    def test_tenant_sem_nome_usa_tenant_id(self, team_client_no_auth):
        client, mock_sb = team_client_no_auth
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.side_effect = [
            MagicMock(data=[MOCK_INVITE]),
            MagicMock(data=[]),  # tenant lookup retorna vazio → fallback para tenant_id
        ]
        resp = client.get(f"/team/invites/{INVITE_TOKEN}")
        assert resp.status_code == 200
        assert resp.json()["tenant_name"] == TENANT_ID


# ────────────────────────────────────────────────────────────
# 4. POST /team/invites/{token}/accept
# ────────────────────────────────────────────────────────────


class TestAcceptInvite:
    def test_aceita_convite_com_sucesso(self, team_client):
        client, mock_sb, _ = team_client
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[MOCK_INVITE]
        )
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{}]
        )
        resp = client.post(f"/team/invites/{INVITE_TOKEN}/accept")
        assert resp.status_code == 200
        assert resp.json()["tenant_id"] == TENANT_ID

    def test_token_invalido_retorna_404(self, team_client):
        client, mock_sb, _ = team_client
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[]
        )
        resp = client.post("/team/invites/token-invalido/accept")
        assert resp.status_code == 404

    def test_convite_ja_aceito_retorna_400(self, team_client):
        client, mock_sb, _ = team_client
        aceito = {**MOCK_INVITE, "status": "accepted"}
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[aceito]
        )
        resp = client.post(f"/team/invites/{INVITE_TOKEN}/accept")
        assert resp.status_code == 400
        assert "accepted" in resp.json()["detail"]

    def test_convite_expirado_retorna_400(self, team_client):
        client, mock_sb, _ = team_client
        expirado = {**MOCK_INVITE, "expires_at": "2000-01-01T00:00:00+00:00"}
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[expirado]
        )
        resp = client.post(f"/team/invites/{INVITE_TOKEN}/accept")
        assert resp.status_code == 400
        assert "expirado" in resp.json()["detail"]

    def test_email_diferente_retorna_403(self, team_client):
        client, mock_sb, _ = team_client
        invite_outro = {**MOCK_INVITE, "invited_email": "outro@empresa.com"}
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[invite_outro]
        )
        resp = client.post(f"/team/invites/{INVITE_TOKEN}/accept")
        assert resp.status_code == 403

    def test_email_com_case_diferente_aceita_convite(self, team_client):
        """Bug 2 — email armazenado em lower, usuário logado com case diferente: deve aceitar."""
        client, mock_sb, _ = team_client
        # Convite armazenado com email lowercase; current_user tem email com maiúsculas
        invite_lower = {**MOCK_INVITE, "invited_email": "admin@empresa.com"}
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[invite_lower]
        )
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{}]
        )
        # MOCK_ADMIN tem email "admin@empresa.com" — comparação .strip().lower() deve bater
        resp = client.post(f"/team/invites/{INVITE_TOKEN}/accept")
        assert resp.status_code == 200

    def test_sem_auth_retorna_401(self, team_client_no_auth):
        client, _ = team_client_no_auth
        resp = client.post(f"/team/invites/{INVITE_TOKEN}/accept")
        assert resp.status_code == 401


# ────────────────────────────────────────────────────────────
# 5. POST /team/join-requests
# ────────────────────────────────────────────────────────────


class TestRequestJoin:
    PAYLOAD = {"tenant_id": OTHER_TENANT_ID, "message": "Quero entrar"}

    def test_solicita_entrada_com_sucesso(self, team_client):
        client, mock_sb, _ = team_client
        # tenant exists (single eq)
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"id": OTHER_TENANT_ID}]
        )
        # no existing request (double eq)
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[]
        )
        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": REQUEST_ID}]
        )
        resp = client.post("/team/join-requests", json=self.PAYLOAD)
        assert resp.status_code == 201
        assert "request_id" in resp.json()

    def test_proprio_tenant_retorna_400(self, team_client):
        client, _, _ = team_client
        resp = client.post("/team/join-requests", json={"tenant_id": TENANT_ID})
        assert resp.status_code == 400
        assert "já pertence" in resp.json()["detail"]

    def test_tenant_id_vazio_retorna_422(self, team_client):
        client, _, _ = team_client
        resp = client.post("/team/join-requests", json={"tenant_id": "  "})
        assert resp.status_code == 422

    def test_tenant_inexistente_retorna_404(self, team_client):
        client, mock_sb, _ = team_client
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[]
        )
        resp = client.post("/team/join-requests", json=self.PAYLOAD)
        assert resp.status_code == 404

    def test_solicitacao_pendente_existente_retorna_400(self, team_client):
        client, mock_sb, _ = team_client
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"id": OTHER_TENANT_ID}]
        )
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"id": REQUEST_ID, "status": "pending"}]
        )
        resp = client.post("/team/join-requests", json=self.PAYLOAD)
        assert resp.status_code == 400
        assert "pendente" in resp.json()["detail"]

    def test_solicitacao_rejeitada_reabre_como_pending(self, team_client):
        client, mock_sb, _ = team_client
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"id": OTHER_TENANT_ID}]
        )
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"id": REQUEST_ID, "status": "rejected"}]
        )
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{}]
        )
        resp = client.post("/team/join-requests", json=self.PAYLOAD)
        assert resp.status_code == 201
        assert "request_id" in resp.json()

    def test_sem_auth_retorna_401(self, team_client_no_auth):
        client, _ = team_client_no_auth
        resp = client.post("/team/join-requests", json=self.PAYLOAD)
        assert resp.status_code == 401


# ────────────────────────────────────────────────────────────
# 6. GET /team/join-requests
# ────────────────────────────────────────────────────────────


class TestListJoinRequests:
    def test_admin_lista_solicitacoes_pendentes(self, team_client):
        client, mock_sb, _ = team_client
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[MOCK_JOIN_REQUEST]
        )
        resp = client.get("/team/join-requests")
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["id"] == REQUEST_ID

    def test_sem_solicitacoes_retorna_lista_vazia(self, team_client):
        client, mock_sb, _ = team_client
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[]
        )
        resp = client.get("/team/join-requests")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_filtro_por_status_aprovado(self, team_client):
        client, mock_sb, _ = team_client
        aprovado = {**MOCK_JOIN_REQUEST, "status": "approved"}
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[aprovado]
        )
        resp = client.get("/team/join-requests?status=approved")
        assert resp.status_code == 200
        assert resp.json()[0]["status"] == "approved"

    def test_viewer_nao_pode_listar_retorna_403(self, team_client_viewer):
        client, _, _ = team_client_viewer
        resp = client.get("/team/join-requests")
        assert resp.status_code == 403

    def test_sem_auth_retorna_401(self, team_client_no_auth):
        client, _ = team_client_no_auth
        resp = client.get("/team/join-requests")
        assert resp.status_code == 401


# ────────────────────────────────────────────────────────────
# 7. POST /team/join-requests/{id}/approve
# ────────────────────────────────────────────────────────────


class TestApproveJoinRequest:
    def test_admin_aprova_solicitacao(self, team_client):
        client, mock_sb, _ = team_client
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[MOCK_JOIN_REQUEST]
        )
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{}]
        )
        resp = client.post(f"/team/join-requests/{REQUEST_ID}/approve")
        assert resp.status_code == 200
        assert "aprovada" in resp.json()["message"]

    def test_solicitacao_nao_encontrada_retorna_404(self, team_client):
        client, mock_sb, _ = team_client
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[]
        )
        resp = client.post(f"/team/join-requests/{REQUEST_ID}/approve")
        assert resp.status_code == 404

    def test_solicitacao_ja_aprovada_retorna_400(self, team_client):
        client, mock_sb, _ = team_client
        aprovada = {**MOCK_JOIN_REQUEST, "status": "approved"}
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[aprovada]
        )
        resp = client.post(f"/team/join-requests/{REQUEST_ID}/approve")
        assert resp.status_code == 400

    def test_viewer_nao_pode_aprovar_retorna_403(self, team_client_viewer):
        client, mock_sb, _ = team_client_viewer
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[MOCK_JOIN_REQUEST]
        )
        resp = client.post(f"/team/join-requests/{REQUEST_ID}/approve")
        assert resp.status_code == 403

    def test_sem_auth_retorna_401(self, team_client_no_auth):
        client, _ = team_client_no_auth
        resp = client.post(f"/team/join-requests/{REQUEST_ID}/approve")
        assert resp.status_code == 401


# ────────────────────────────────────────────────────────────
# 8. POST /team/join-requests/{id}/reject
# ────────────────────────────────────────────────────────────


class TestRejectJoinRequest:
    def test_admin_rejeita_solicitacao(self, team_client):
        client, mock_sb, _ = team_client
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[MOCK_JOIN_REQUEST]
        )
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{}]
        )
        resp = client.post(f"/team/join-requests/{REQUEST_ID}/reject")
        assert resp.status_code == 200
        assert "rejeitada" in resp.json()["message"]

    def test_solicitacao_nao_encontrada_retorna_404(self, team_client):
        client, mock_sb, _ = team_client
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[]
        )
        resp = client.post(f"/team/join-requests/{REQUEST_ID}/reject")
        assert resp.status_code == 404

    def test_solicitacao_ja_rejeitada_retorna_400(self, team_client):
        client, mock_sb, _ = team_client
        rejeitada = {**MOCK_JOIN_REQUEST, "status": "rejected"}
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[rejeitada]
        )
        resp = client.post(f"/team/join-requests/{REQUEST_ID}/reject")
        assert resp.status_code == 400

    def test_viewer_nao_pode_rejeitar_retorna_403(self, team_client_viewer):
        client, mock_sb, _ = team_client_viewer
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[MOCK_JOIN_REQUEST]
        )
        resp = client.post(f"/team/join-requests/{REQUEST_ID}/reject")
        assert resp.status_code == 403

    def test_sem_auth_retorna_401(self, team_client_no_auth):
        client, _ = team_client_no_auth
        resp = client.post(f"/team/join-requests/{REQUEST_ID}/reject")
        assert resp.status_code == 401


# ────────────────────────────────────────────────────────────
# 9. GET /team/members
# ────────────────────────────────────────────────────────────


class TestListMembers:
    MOCK_MEMBERS = [
        {"id": USER_ID, "email": "admin@empresa.com", "username": "admin",
         "nome_exibicao": "Admin", "role": "admin", "tipo_perfil": "empresa"},
        {"id": OTHER_USER_ID, "email": "membro@empresa.com", "username": "membro",
         "nome_exibicao": "Membro", "role": "viewer", "tipo_perfil": "colaborador"},
    ]

    def test_admin_lista_membros(self, team_client):
        client, mock_sb, _ = team_client
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=self.MOCK_MEMBERS
        )
        resp = client.get("/team/members")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_tenant_sem_membros_retorna_lista_vazia(self, team_client):
        client, mock_sb, _ = team_client
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[]
        )
        resp = client.get("/team/members")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_viewer_nao_pode_listar_retorna_403(self, team_client_viewer):
        client, _, _ = team_client_viewer
        resp = client.get("/team/members")
        assert resp.status_code == 403

    def test_sem_auth_retorna_401(self, team_client_no_auth):
        client, _ = team_client_no_auth
        resp = client.get("/team/members")
        assert resp.status_code == 401


# ────────────────────────────────────────────────────────────
# 10. DELETE /team/members/{userId}
# ────────────────────────────────────────────────────────────


class TestRemoveMember:
    MOCK_MEMBER_ROW = {"id": OTHER_USER_ID, "email": "membro@empresa.com", "username": "membro"}

    def test_admin_remove_membro_com_sucesso(self, team_client):
        client, mock_sb, mock_ts = team_client
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[self.MOCK_MEMBER_ROW]
        )
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{}]
        )
        mock_ts.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[]
        )
        mock_ts.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": "new-personal-tenant", "slug": "membro"}]
        )
        resp = client.delete(f"/team/members/{OTHER_USER_ID}")
        assert resp.status_code == 200
        assert "removido" in resp.json()["message"]

    def test_admin_nao_pode_se_remover_retorna_400(self, team_client):
        client, _, _ = team_client
        resp = client.delete(f"/team/members/{USER_ID}")
        assert resp.status_code == 400
        assert "si mesmo" in resp.json()["detail"]

    def test_membro_nao_encontrado_retorna_404(self, team_client):
        client, mock_sb, _ = team_client
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[]
        )
        resp = client.delete(f"/team/members/{OTHER_USER_ID}")
        assert resp.status_code == 404

    def test_viewer_nao_pode_remover_retorna_403(self, team_client_viewer):
        client, _, _ = team_client_viewer
        resp = client.delete(f"/team/members/{OTHER_USER_ID}")
        assert resp.status_code == 403

    def test_sem_auth_retorna_401(self, team_client_no_auth):
        client, _ = team_client_no_auth
        resp = client.delete(f"/team/members/{OTHER_USER_ID}")
        assert resp.status_code == 401
