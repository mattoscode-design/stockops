-- Migration 011: tenant_invites e tenant_join_requests
-- Sistema de convites e solicitações de entrada em tenants
-- Execução: Supabase SQL Editor

-- ─────────────────────────────────────────────────────────────
-- 1. tenant_invites
--    Admin convida usuário externo por email.
--    Token único de 7 dias — aceito pelo convidado via POST /tenants/invite/accept
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_invites (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invited_email TEXT      NOT NULL,
    invited_by  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT        NOT NULL DEFAULT 'viewer',
    token       TEXT        NOT NULL UNIQUE,
    status      TEXT        NOT NULL DEFAULT 'pending',
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,

    CONSTRAINT valid_invite_status CHECK (status IN ('pending', 'accepted', 'cancelled')),
    CONSTRAINT valid_invite_role   CHECK (role IN ('admin', 'viewer'))
);

-- ─────────────────────────────────────────────────────────────
-- 2. tenant_join_requests
--    Usuário solicita entrada em um tenant. Admin aprova ou rejeita.
--    UNIQUE (tenant_id, user_id) evita solicitações duplicadas.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_join_requests (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      TEXT        NOT NULL DEFAULT 'pending',
    message     TEXT,
    reviewed_by UUID        REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,

    CONSTRAINT valid_join_status CHECK (status IN ('pending', 'approved', 'rejected')),
    UNIQUE (tenant_id, user_id)
);

-- ─────────────────────────────────────────────────────────────
-- 3. Índices
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tenant_invites_tenant_id
    ON tenant_invites(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_invites_email
    ON tenant_invites(invited_email);

CREATE INDEX IF NOT EXISTS idx_tenant_invites_token
    ON tenant_invites(token);

CREATE INDEX IF NOT EXISTS idx_tenant_invites_status
    ON tenant_invites(status);

CREATE INDEX IF NOT EXISTS idx_tenant_join_requests_tenant_id
    ON tenant_join_requests(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_join_requests_user_id
    ON tenant_join_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_tenant_join_requests_status
    ON tenant_join_requests(status);

-- ─────────────────────────────────────────────────────────────
-- 4. RLS
--    O backend usa service_role que bypassa RLS automaticamente.
--    RLS atua como segunda camada para acessos diretos ao banco.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE tenant_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_join_requests ENABLE ROW LEVEL SECURITY;

-- Bloqueia acesso direto via anon key (frontend não acessa essas tabelas)
CREATE POLICY "deny_anon_invites"
    ON tenant_invites FOR ALL
    TO anon
    USING (false);

CREATE POLICY "deny_anon_join_requests"
    ON tenant_join_requests FOR ALL
    TO anon
    USING (false);
