-- Migration 006: Tabela inventories + inventory_id em inventory_items
-- Introduz o conceito de "inventário nomeado" por tenant — permite múltiplos
-- inventários (ex: "Estoque Principal", "Filial Norte") sob o mesmo tenant.
-- inventory_id é nullable nesta migration para não quebrar código existente;
-- T4 deve popular o campo via código antes de considerar NOT NULL em migration futura.
-- Execute no Supabase: Dashboard → SQL Editor → cole e execute

-- ─────────────────────────────────────────────
-- 1. Criar tabela inventories
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    active      BOOLEAN DEFAULT TRUE,
    UNIQUE(tenant_id, name)
);

-- ─────────────────────────────────────────────
-- 2. Adicionar inventory_id em inventory_items
--    nullable agora — T4 migra o código antes de tornar NOT NULL
-- ─────────────────────────────────────────────

ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS inventory_id UUID DEFAULT NULL
        REFERENCES inventories(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────
-- 3. Seed — inventário padrão para o tenant demo
-- ─────────────────────────────────────────────

INSERT INTO inventories (tenant_id, name, description)
SELECT id, 'Estoque Principal', 'Inventário padrão migrado automaticamente'
FROM   tenants
WHERE  slug = 'demo'
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ─────────────────────────────────────────────
-- 4. Backfill — vincular registros existentes ao inventário padrão
-- ─────────────────────────────────────────────

UPDATE inventory_items ii
SET    inventory_id = inv.id
FROM   inventories inv
WHERE  inv.tenant_id = ii.tenant_id
  AND  inv.name      = 'Estoque Principal'
  AND  ii.inventory_id IS NULL;

-- ─────────────────────────────────────────────
-- 5. Índices
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_inventories_tenant     ON inventories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_inv_id ON inventory_items(inventory_id);

-- ─────────────────────────────────────────────
-- 6. Row Level Security
-- ─────────────────────────────────────────────

ALTER TABLE inventories ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON inventories
    USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- ─────────────────────────────────────────────
-- Verificação
-- ─────────────────────────────────────────────
-- SELECT i.name, COUNT(ii.id) AS itens_vinculados
-- FROM   inventories i
-- LEFT JOIN inventory_items ii ON ii.inventory_id = i.id
-- GROUP BY i.id, i.name;
