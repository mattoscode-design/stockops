-- Migration 008: Campos de perfil em public.users
-- nome_exibicao: como o usuário quer ser chamado na UI (independente do username)
-- tipo_perfil:   'empresa' = dono/distribuidora | 'colaborador' = funcionário
-- empresa_nome:  preenchido quando tipo_perfil = 'colaborador' para indicar
--                a qual distribuidora o colaborador pertence
-- Todos nullable para não quebrar registros existentes (seed admin incluído).
-- Execute no Supabase: Dashboard → SQL Editor → cole e execute

-- ─────────────────────────────────────────────
-- 1. Adicionar colunas de perfil
-- ─────────────────────────────────────────────

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS nome_exibicao VARCHAR(255)                                      DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS tipo_perfil   VARCHAR(20)  DEFAULT 'colaborador'
                                               CHECK (tipo_perfil IN ('empresa', 'colaborador')),
    ADD COLUMN IF NOT EXISTS empresa_nome  VARCHAR(255)                                      DEFAULT NULL;

-- ─────────────────────────────────────────────
-- Verificação — deve listar as novas colunas
-- ─────────────────────────────────────────────
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'users' AND table_schema = 'public'
-- ORDER BY ordinal_position;
