-- Migration 001: Multi-tenant support
-- Adiciona suporte a múltiplos clientes (distribuidoras) no mesmo sistema
-- Execute no Supabase: Dashboard → SQL Editor → cole e execute

-- ─────────────────────────────────────────────
-- TABELAS
-- ─────────────────────────────────────────────

-- Distribuidoras (tenants)
CREATE TABLE IF NOT EXISTS tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(100) UNIQUE NOT NULL,  -- ex: "distribuidora-abc"
    plan        VARCHAR(50)  DEFAULT 'free',   -- free | pro | enterprise
    created_at  TIMESTAMPTZ  DEFAULT NOW(),
    active      BOOLEAN      DEFAULT TRUE
);

-- Usuários com tenant
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    username      VARCHAR(100) NOT NULL,
    password_hash TEXT NOT NULL,
    role          VARCHAR(50) DEFAULT 'analyst',  -- admin | analyst | viewer
    email         VARCHAR(255),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    active        BOOLEAN DEFAULT TRUE,
    UNIQUE(tenant_id, username)
);

-- Análises salvas por tenant
CREATE TABLE IF NOT EXISTS analyses (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id),
    filename      VARCHAR(255),
    total_skus    INTEGER NOT NULL,
    skus_criticos INTEGER NOT NULL,
    perda_total   NUMERIC(12,2) NOT NULL,
    result_json   JSONB NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Inventário (migra localStorage → banco)
CREATE TABLE IF NOT EXISTS inventory_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sku             VARCHAR(100) NOT NULL,
    loja            VARCHAR(100) NOT NULL,
    categoria       VARCHAR(100) DEFAULT 'Sem Categoria',
    estoque_atual   NUMERIC(10,2) NOT NULL DEFAULT 0,
    vendas_diarias  NUMERIC(10,2) NOT NULL DEFAULT 0,
    preco_medio     NUMERIC(10,2) NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, sku, loja)
);

-- Ledger de movimentos de inventário
CREATE TABLE IF NOT EXISTS inventory_movements (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    item_id     UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    tipo        VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    quantidade  NUMERIC(10,2) NOT NULL,
    motivo      TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- ÍNDICES
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_analyses_tenant     ON analyses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_tenant        ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant    ON inventory_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sku       ON inventory_items(tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_movements_item      ON inventory_movements(item_id);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

ALTER TABLE analyses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON analyses
    USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY tenant_isolation ON inventory_items
    USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY tenant_isolation ON inventory_movements
    USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- ─────────────────────────────────────────────
-- SEED — Tenant Demo + Admin
-- ─────────────────────────────────────────────

-- Tenant de demonstração
INSERT INTO tenants (name, slug, plan) VALUES
    ('StockOps Demo', 'demo', 'pro')
ON CONFLICT (slug) DO NOTHING;

-- Usuário admin (senha: admin123)
-- Hash bcrypt gerado em 2026-05-14: admin123
INSERT INTO users (tenant_id, username, password_hash, role)
SELECT id,
       'admin',
       '$2b$12$dFGtxSEX2RE11z2v4w26VuiTGRMx5P.qDkFt70IGGbMJY/2gsiNzG',
       'admin'
FROM   tenants
WHERE  slug = 'demo'
ON CONFLICT (tenant_id, username) DO NOTHING;
