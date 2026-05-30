"""
Testes dos endpoints de autenticação — Supabase Auth mockado.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient

MOCK_USER_ROW = {
    "id": "user-001",
    "username": "admin",
    "email": "admin@stockops.com",
    "role": "admin",
    "tenant_id": "tenant-001",
    "auth_id": "auth-uuid-001",
}

MOCK_CURRENT_USER = {
    "user_id": "user-001",
    "username": "admin",
    "email": "admin@stockops.com",
    "role": "admin",
    "tenant_id": "tenant-001",
    "auth_id": "auth-uuid-001",
    "nome_exibicao": None,
    "tipo_perfil": "colaborador",
    "empresa_nome": None,
}


@pytest.fixture
def app_client():
    from routers.auth import router

    test_app = FastAPI()
    test_app.include_router(router)
    with patch("routers.auth.supabase") as mock_sb, patch(
        "routers.auth.supabase_auth"
    ) as mock_auth_sb:
        yield TestClient(test_app, raise_server_exceptions=True), mock_sb, mock_auth_sb


@pytest.fixture
def auth_client():
    """Fixture para endpoints que requerem autenticação (get_current_user mockado)."""
    from routers.auth import router, get_current_user

    test_app = FastAPI()
    test_app.include_router(router)
    test_app.dependency_overrides[get_current_user] = lambda: MOCK_CURRENT_USER
    with patch("routers.auth.supabase") as mock_sb, patch(
        "routers.auth.supabase_auth"
    ) as mock_auth_sb:
        yield TestClient(test_app, raise_server_exceptions=True), mock_sb, mock_auth_sb
    test_app.dependency_overrides.clear()


# ────────────────────────────────────────────────────────────
# POST /auth/register
# ────────────────────────────────────────────────────────────


class TestRegister:
    PAYLOAD_EMPRESA = {
        "email": "empresa@stockops.com",
        "password": "senha123",
        "tipo_perfil": "empresa",
        "empresa_nome": "Distribuidora XYZ",
    }
    PAYLOAD_COLABORADOR = {
        "email": "colaborador@stockops.com",
        "password": "senha123",
        "tipo_perfil": "colaborador",
        "nome_exibicao": "João Silva",
    }

    def test_registro_empresa_cria_tenant_proprio(self, app_client):
        client, mock_sb, mock_auth_sb = app_client
        mock_auth_sb.auth.sign_up.return_value = MagicMock(
            user=MagicMock(id="auth-uuid-002")
        )
        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[MOCK_USER_ROW]
        )
        with patch("routers.auth.create_tenant", return_value="new-tenant-uuid"):
            resp = client.post("/auth/register", json=self.PAYLOAD_EMPRESA)
        assert resp.status_code == 201
        assert "message" in resp.json()

    def test_registro_colaborador_cria_tenant_proprio(self, app_client):
        """Colaborador: tenant usa nome_exibicao (não username)."""
        client, mock_sb, mock_auth_sb = app_client
        mock_auth_sb.auth.sign_up.return_value = MagicMock(
            user=MagicMock(id="auth-uuid-003")
        )
        mock_sb.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[MOCK_USER_ROW]
        )
        with patch("routers.auth.create_tenant", return_value="colab-tenant-uuid") as mock_ct:
            resp = client.post("/auth/register", json=self.PAYLOAD_COLABORADOR)
        assert resp.status_code == 201
        assert "message" in resp.json()
        # Verifica que o nome passado ao create_tenant é nome_exibicao
        mock_ct.assert_called_once()
        assert mock_ct.call_args[0][0] == "João Silva"

    def test_empresa_sem_empresa_nome_retorna_400(self, app_client):
        client, mock_sb, _ = app_client
        # slug check retorna vazio (slug disponível), mas empresa_nome ausente → 400 antes disso
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[]
        )
        resp = client.post(
            "/auth/register",
            json={"email": "e@test.com", "password": "senha", "tipo_perfil": "empresa"},
        )
        assert resp.status_code == 400

    def test_tipo_perfil_invalido_retorna_422(self, app_client):
        client, _, _ = app_client
        resp = client.post(
            "/auth/register",
            json={"email": "a@b.com", "password": "senha", "tipo_perfil": "gerente"},
        )
        assert resp.status_code == 422

    def test_email_vazio_retorna_422(self, app_client):
        client, _, _ = app_client
        resp = client.post(
            "/auth/register",
            json={"email": "  ", "password": "senha", "tipo_perfil": "colaborador"},
        )
        assert resp.status_code == 422

    def test_campos_ausentes_retornam_422(self, app_client):
        client, _, _ = app_client
        resp = client.post("/auth/register", json={"email": "a@b.com"})
        assert resp.status_code == 422

    def test_supabase_auth_falha_retorna_400(self, app_client):
        client, _, mock_auth_sb = app_client
        mock_auth_sb.auth.sign_up.side_effect = Exception("Email already registered")
        # auth falha antes de create_tenant ser chamado — nenhum mock de DB necessário
        resp = client.post("/auth/register", json=self.PAYLOAD_COLABORADOR)
        assert resp.status_code == 400

    def test_sign_up_sem_user_retorna_400(self, app_client):
        client, _, mock_auth_sb = app_client
        mock_auth_sb.auth.sign_up.return_value = MagicMock(user=None)
        # auth retorna user=None → falha antes de create_tenant
        resp = client.post("/auth/register", json=self.PAYLOAD_COLABORADOR)
        assert resp.status_code == 400


# ────────────────────────────────────────────────────────────
# POST /auth/login
# ────────────────────────────────────────────────────────────


class TestLogin:
    VALID_PAYLOAD = {"email": "admin@stockops.com", "password": "admin123"}

    def test_login_sucesso_otp_enviado(self, app_client):
        client, _, mock_auth_sb = app_client
        mock_auth_sb.auth.sign_in_with_password.return_value = MagicMock(
            session=MagicMock()
        )
        mock_auth_sb.auth.sign_in_with_otp.return_value = MagicMock()

        resp = client.post("/auth/login", json=self.VALID_PAYLOAD)
        assert resp.status_code == 200
        assert resp.json()["message"] == "Código 2FA enviado para o email"

    def test_otp_send_falha_retorna_500(self, app_client):
        client, _, mock_auth_sb = app_client
        mock_auth_sb.auth.sign_in_with_password.return_value = MagicMock(
            session=MagicMock()
        )
        mock_auth_sb.auth.sign_in_with_otp.side_effect = Exception(
            "OTP service unavailable"
        )

        resp = client.post("/auth/login", json=self.VALID_PAYLOAD)
        assert resp.status_code == 500
        assert "2FA" in resp.json()["detail"]

    def test_credenciais_invalidas_retornam_401(self, app_client):
        client, _, mock_auth_sb = app_client
        mock_auth_sb.auth.sign_in_with_password.side_effect = Exception(
            "Invalid credentials"
        )

        resp = client.post("/auth/login", json=self.VALID_PAYLOAD)
        assert resp.status_code == 401
        assert resp.json()["detail"] == "Credenciais inválidas"

    def test_campos_ausentes_retornam_422(self, app_client):
        client, _, _ = app_client
        resp = client.post("/auth/login", json={"email": "admin@stockops.com"})
        assert resp.status_code == 422

    def test_email_vazio_retorna_422(self, app_client):
        client, _, _ = app_client
        resp = client.post("/auth/login", json={"email": "", "password": "123"})
        assert resp.status_code == 422


# ────────────────────────────────────────────────────────────
# POST /auth/verify
# ────────────────────────────────────────────────────────────


class TestVerify:
    VALID_PAYLOAD = {"email": "admin@stockops.com", "token": "123456"}

    def test_verify_sucesso_retorna_jwt(self, app_client):
        client, _, mock_auth_sb = app_client
        mock_auth_sb.auth.verify_otp.return_value = MagicMock(
            session=MagicMock(access_token="supabase-jwt-token", token_type="bearer")
        )

        resp = client.post("/auth/verify", json=self.VALID_PAYLOAD)
        assert resp.status_code == 200
        assert resp.json()["access_token"] == "supabase-jwt-token"
        assert resp.json()["token_type"] == "bearer"

    def test_otp_invalido_retorna_401(self, app_client):
        client, _, mock_auth_sb = app_client
        mock_auth_sb.auth.verify_otp.side_effect = Exception("OTP expired")

        resp = client.post("/auth/verify", json=self.VALID_PAYLOAD)
        assert resp.status_code == 401
        assert "OTP" in resp.json()["detail"]

    def test_session_nula_retorna_401(self, app_client):
        client, _, mock_auth_sb = app_client
        mock_auth_sb.auth.verify_otp.return_value = MagicMock(session=None)

        resp = client.post("/auth/verify", json=self.VALID_PAYLOAD)
        assert resp.status_code == 401

    def test_campos_ausentes_retornam_422(self, app_client):
        client, _, _ = app_client
        resp = client.post("/auth/verify", json={"email": "admin@stockops.com"})
        assert resp.status_code == 422


# ────────────────────────────────────────────────────────────
# POST /auth/forgot-password
# ────────────────────────────────────────────────────────────


class TestForgotPassword:
    VALID_PAYLOAD = {"email": "admin@stockops.com"}

    def test_email_cadastrado_retorna_200(self, app_client):
        client, _, mock_auth_sb = app_client
        mock_auth_sb.auth.reset_password_for_email.return_value = None

        resp = client.post("/auth/forgot-password", json=self.VALID_PAYLOAD)
        assert resp.status_code == 200
        assert resp.json()["message"] == "Email de redefinição enviado"

    def test_email_nao_cadastrado_retorna_200(self, app_client):
        """Não revela se o email existe (user enumeration prevention)."""
        client, _, mock_auth_sb = app_client
        mock_auth_sb.auth.reset_password_for_email.side_effect = Exception(
            "User not found"
        )

        resp = client.post("/auth/forgot-password", json=self.VALID_PAYLOAD)
        assert resp.status_code == 200
        assert resp.json()["message"] == "Email de redefinição enviado"

    def test_supabase_falha_retorna_200(self, app_client):
        """Qualquer falha interna ainda retorna 200."""
        client, _, mock_auth_sb = app_client
        mock_auth_sb.auth.reset_password_for_email.side_effect = Exception(
            "Service unavailable"
        )

        resp = client.post("/auth/forgot-password", json=self.VALID_PAYLOAD)
        assert resp.status_code == 200

    def test_body_ausente_retorna_422(self, app_client):
        client, _, _ = app_client
        resp = client.post("/auth/forgot-password", json={})
        assert resp.status_code == 422


# ────────────────────────────────────────────────────────────
# GET /auth/me
# ────────────────────────────────────────────────────────────


class TestMe:
    def test_retorna_dados_do_usuario(self, auth_client):
        client, mock_sb, _ = auth_client
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[{"name": "Empresa ABC"}]
        )
        resp = client.get("/auth/me", headers={"Authorization": "Bearer valid-token"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == "user-001"
        assert body["email"] == "admin@stockops.com"
        assert body["role"] == "admin"
        assert body["tenant_id"] == "tenant-001"
        assert body["tenant_name"] == "Empresa ABC"
        assert "username" in body
        assert "nome_exibicao" in body
        assert "tipo_perfil" in body
        assert "empresa_nome" in body

    def test_tenant_name_none_quando_tenant_nao_encontrado(self, auth_client):
        client, mock_sb, _ = auth_client
        mock_sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[]
        )
        resp = client.get("/auth/me", headers={"Authorization": "Bearer valid-token"})
        assert resp.status_code == 200
        assert resp.json()["tenant_name"] is None

    def test_sem_token_retorna_401(self, app_client):
        client, _, _ = app_client
        resp = client.get("/auth/me")
        assert resp.status_code == 401


# ────────────────────────────────────────────────────────────
# PUT /auth/profile
# ────────────────────────────────────────────────────────────


class TestUpdateProfile:
    def test_atualiza_nome_exibicao(self, auth_client):
        client, mock_sb, _ = auth_client
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{}]
        )

        resp = client.put(
            "/auth/profile",
            json={"nome_exibicao": "Gabriel Mattos"},
            headers={"Authorization": "Bearer valid-token"},
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Perfil atualizado"

    def test_atualiza_multiplos_campos(self, auth_client):
        client, mock_sb, _ = auth_client
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{}]
        )

        resp = client.put(
            "/auth/profile",
            json={
                "nome_exibicao": "Gabriel",
                "tipo_perfil": "empresa",
                "empresa_nome": "Dist. XYZ",
            },
            headers={"Authorization": "Bearer valid-token"},
        )
        assert resp.status_code == 200

    def test_body_vazio_retorna_mensagem_sem_atualizar(self, auth_client):
        client, mock_sb, _ = auth_client
        resp = client.put(
            "/auth/profile",
            json={},
            headers={"Authorization": "Bearer valid-token"},
        )
        assert resp.status_code == 200
        assert "Nenhum campo" in resp.json()["message"]
        mock_sb.table.assert_not_called()

    def test_supabase_falha_retorna_500(self, auth_client):
        client, mock_sb, _ = auth_client
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.side_effect = Exception(
            "DB error"
        )

        resp = client.put(
            "/auth/profile",
            json={"nome_exibicao": "Teste"},
            headers={"Authorization": "Bearer valid-token"},
        )
        assert resp.status_code == 500

    def test_sem_token_retorna_401(self, app_client):
        client, _, _ = app_client
        resp = client.put("/auth/profile", json={"nome_exibicao": "X"})
        assert resp.status_code == 401

    def test_atualiza_username_disponivel(self, auth_client):
        client, mock_sb, _ = auth_client
        # conflict check retorna vazio → username livre
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.neq.return_value.execute.return_value = MagicMock(
            data=[]
        )
        mock_sb.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{}]
        )

        resp = client.put(
            "/auth/profile",
            json={"username": "gabriel_novo"},
            headers={"Authorization": "Bearer valid-token"},
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Perfil atualizado"

    def test_username_duplicado_retorna_400(self, auth_client):
        client, mock_sb, _ = auth_client
        # conflict check retorna outro usuário com mesmo username
        mock_sb.table.return_value.select.return_value.eq.return_value.eq.return_value.neq.return_value.execute.return_value = MagicMock(
            data=[{"id": "user-999"}]
        )

        resp = client.put(
            "/auth/profile",
            json={"username": "admin_existente"},
            headers={"Authorization": "Bearer valid-token"},
        )
        assert resp.status_code == 400
        assert "Username" in resp.json()["detail"]


# ────────────────────────────────────────────────────────────
# POST /auth/logout
# ────────────────────────────────────────────────────────────


class TestLogout:
    def test_logout_com_sucesso(self, app_client):
        client, mock_sb, _ = app_client
        mock_sb.auth.admin.sign_out.return_value = None

        resp = client.post(
            "/auth/logout", headers={"Authorization": "Bearer valid-token"}
        )
        assert resp.status_code == 204

    def test_logout_sem_token_retorna_401(self, app_client):
        client, _, _ = app_client
        resp = client.post("/auth/logout")
        assert resp.status_code == 401

    def test_logout_best_effort_ignora_falha_supabase(self, app_client):
        """sign_out levantando exceção não deve resultar em erro para o cliente."""
        client, mock_sb, _ = app_client
        mock_sb.auth.admin.sign_out.side_effect = Exception("Session not found")

        resp = client.post(
            "/auth/logout", headers={"Authorization": "Bearer expired-token"}
        )
        assert resp.status_code == 204
