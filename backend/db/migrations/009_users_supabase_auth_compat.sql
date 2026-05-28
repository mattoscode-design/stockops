-- Migration 009: Compatibilidade com Supabase Auth em public.users
-- O novo fluxo de registro usa Supabase Auth (auth.users) como camada de
-- autenticação. username e password_hash não são mais enviados no INSERT,
-- causando erro NOT NULL no PostgreSQL.
-- username e password_hash tornam-se nullable — auth_id (007) é o vínculo
-- com a identidade real do usuário.
-- Execute no Supabase: Dashboard → SQL Editor → cole e execute

-- ─────────────────────────────────────────────
-- 1. Tornar username nullable
-- ─────────────────────────────────────────────

ALTER TABLE public.users
    ALTER COLUMN username DROP NOT NULL;

-- ─────────────────────────────────────────────
-- 2. Tornar password_hash nullable
-- ─────────────────────────────────────────────

ALTER TABLE public.users
    ALTER COLUMN password_hash DROP NOT NULL;

-- ─────────────────────────────────────────────
-- Verificação — ambas devem aparecer como is_nullable = YES
-- ─────────────────────────────────────────────
-- SELECT column_name, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'users' AND table_schema = 'public'
--   AND column_name IN ('username', 'password_hash');
