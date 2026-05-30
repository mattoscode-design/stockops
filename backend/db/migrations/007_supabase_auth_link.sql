-- Migration 007: Linka public.users com auth.users do Supabase Auth
-- O Supabase Auth gerencia autenticação em auth.users (schema interno).
-- auth_id é a ponte entre o nosso public.users (RBAC/tenant) e o auth.users
-- (sessões, JWT, MFA). Nullable para não quebrar o usuário admin do seed —
-- T4 deve popular via código ao criar/logar usuários.
-- MFA/2FA por email: habilitado no dashboard (Authentication → Settings → Enable MFA).
-- Execute no Supabase: Dashboard → SQL Editor → cole e execute

-- ─────────────────────────────────────────────
-- 1. Adicionar auth_id em public.users
-- ─────────────────────────────────────────────

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE DEFAULT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────
-- 2. Índice para lookup rápido por auth_id
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);

-- ─────────────────────────────────────────────
-- Nota: auth.users não tem RLS aplicável por T5 —
-- é schema interno do Supabase, gerenciado via supabase-py Auth API.
-- ─────────────────────────────────────────────

-- ─────────────────────────────────────────────
-- Verificação — deve listar auth_id como nullable
-- ─────────────────────────────────────────────
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'users' AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- Verificar acesso a auth.users:
-- SELECT id, email, created_at FROM auth.users LIMIT 5;
