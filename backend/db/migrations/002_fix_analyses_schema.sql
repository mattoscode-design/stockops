-- Migration 002: Corrige schema da tabela analyses
-- Alinha nomes de coluna do banco com o código (routers/analyses.py + schemas.py)
-- Execute no Supabase: Dashboard → SQL Editor → cole e execute

-- Divergências corrigidas:
--   perda_total       → perda_total_estimada  (renomear)
--   result_json       → resultados            (renomear)
--   relatorio         → adicionar coluna nova  (inexistente no 001)
--   user_id NOT NULL  → nullable              (código envia None quando não há user)

-- ─────────────────────────────────────────────
-- 1. Renomear perda_total → perda_total_estimada
-- ─────────────────────────────────────────────
ALTER TABLE analyses
    RENAME COLUMN perda_total TO perda_total_estimada;

-- ─────────────────────────────────────────────
-- 2. Renomear result_json → resultados
-- ─────────────────────────────────────────────
ALTER TABLE analyses
    RENAME COLUMN result_json TO resultados;

-- ─────────────────────────────────────────────
-- 3. Adicionar coluna relatorio (ausente no 001)
-- ─────────────────────────────────────────────
ALTER TABLE analyses
    ADD COLUMN IF NOT EXISTS relatorio TEXT NOT NULL DEFAULT '';

-- ─────────────────────────────────────────────
-- 4. Tornar user_id nullable
--    (o código envia None quando o user_id não está disponível)
-- ─────────────────────────────────────────────
ALTER TABLE analyses
    ALTER COLUMN user_id DROP NOT NULL;

-- ─────────────────────────────────────────────
-- Verificação — deve retornar as colunas corretas
-- ─────────────────────────────────────────────
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'analyses'
-- ORDER BY ordinal_position;
