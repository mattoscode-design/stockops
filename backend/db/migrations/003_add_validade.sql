-- Migration 003: Adiciona data_validade em inventory_items
-- Campo opcional (nullable) para persistir validade do produto por SKU/loja.
-- Tipo DATE permite calcular dias restantes em runtime — score de risco dinâmico.
-- Execute no Supabase: Dashboard → SQL Editor → cole e execute

-- ─────────────────────────────────────────────
-- 1. Adicionar coluna data_validade
-- ─────────────────────────────────────────────

ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS data_validade DATE DEFAULT NULL;

-- ─────────────────────────────────────────────
-- Verificação — deve listar a nova coluna
-- ─────────────────────────────────────────────
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'inventory_items'
-- ORDER BY ordinal_position;
