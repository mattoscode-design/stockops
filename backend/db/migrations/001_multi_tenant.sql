-- Migration 001: Multi-tenant support
-- Adiciona suporte a múltiplos clientes (distribuidoras) no mesmo sistema
-- Execute no Supabase: Dashboard → SQL Editor → cole e execute

-- Tabela de tenants (distribuidoras/empresas)
CREATE TABLE IF NOT EXISTS tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(100) UNIQUE NOT NULL,  -- ex: "distribuidora-abc"
    plan        VARCHAR(50)  DEFAULT 'free',   -- free | pro | enterprise
    created_at  TIMESTAMPTZ  DEFAULT NOW(),
    active      BOOLEAN      DEFAULT TRUE
);

-- Tabela de usuários com tenant
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    username    VARCHAR(100) NOT NULL,
    password_hash TEXT NOT NULL,
    role        VARCHAR(50) DEFAULT 'analyst',  -- admin | analyst | viewer
    email       VARCHAR(255),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    active      BOOLEAN DEFAULT TRUE,
    UNIQUE(tenant_id, username)
);

-- Tabela de análises por tenant
CREATE TABLE IF NOT EXISTS analyses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    filename        VARCHAR(255),
    total_skus      INTEGER NOT NULL,
    skus_criticos   INTEGER NOT NULL,
    perda_total     NUMERIC(12,2) NOT NULL,
    result_json     JSONB NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_analyses_tenant     ON analyses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_tenant        ON users(tenant_id);

-- Tenant de demonstração
INSERT INTO tenants (name, slug, plan) VALUES
    ('StockOps Demo', 'demo', 'pro')
ON CONFLICT (slug) DO NOTHING;

-- Comentário: para habilitar Row Level Security (Supabase)
-- ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_isolation ON analyses
--     USING (tenant_id = current_setting('app.tenant_id')::UUID);
