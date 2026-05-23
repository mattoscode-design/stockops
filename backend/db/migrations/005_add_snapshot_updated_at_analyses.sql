-- Migration 005: Adiciona items_snapshot e updated_at em analyses
-- items_snapshot: JSONB nullable — persiste o estado completo dos inventory_items
--   no momento da análise (snapshot imutável para auditoria e replay).
-- updated_at: timestamp de última modificação do registro — útil para cache
--   invalidation e ordenação por "mais recentemente atualizado".
-- Execute no Supabase: Dashboard → SQL Editor → cole e execute

-- ─────────────────────────────────────────────
-- 1. Adicionar coluna items_snapshot
-- ─────────────────────────────────────────────

ALTER TABLE analyses
    ADD COLUMN IF NOT EXISTS items_snapshot JSONB DEFAULT NULL;

-- ─────────────────────────────────────────────
-- 2. Adicionar coluna updated_at
-- ─────────────────────────────────────────────

ALTER TABLE analyses
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ─────────────────────────────────────────────
-- 3. Trigger: atualiza updated_at automaticamente a cada UPDATE
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS analyses_set_updated_at ON analyses;

CREATE TRIGGER analyses_set_updated_at
    BEFORE UPDATE ON analyses
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────
-- Verificação — deve listar as novas colunas
-- ─────────────────────────────────────────────
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'analyses'
-- ORDER BY ordinal_position;
