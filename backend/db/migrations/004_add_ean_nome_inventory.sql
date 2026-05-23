-- Migration 004: Adiciona ean e nome em inventory_items
-- ean: código de barras EAN-13/EAN-8, texto nullable (nem todo SKU tem EAN cadastrado).
-- nome: nome legível do produto — elimina dependência do SKU opaco na UI.
-- Ambos opcionais para manter compatibilidade com planilhas existentes (sem quebrar 003).
-- Execute no Supabase: Dashboard → SQL Editor → cole e execute

-- ─────────────────────────────────────────────
-- 1. Adicionar coluna ean
-- ─────────────────────────────────────────────

ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS ean TEXT DEFAULT NULL;

-- ─────────────────────────────────────────────
-- 2. Adicionar coluna nome
-- ─────────────────────────────────────────────

ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS nome TEXT DEFAULT NULL;

-- ─────────────────────────────────────────────
-- Verificação — deve listar as novas colunas
-- ─────────────────────────────────────────────
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'inventory_items'
-- ORDER BY ordinal_position;
