-- Migration 010: Bootstrap tenant stockops-v1 + vinculo de perfis Supabase Auth
--
-- Cenário alvo:
-- - auth.users possui usuários válidos (login/OTP funciona)
-- - public.tenants está vazio (ou sem slug='stockops-v1')
-- - public.users não possui linha com auth_id para esses usuários
--
-- Efeito:
-- 1) garante tenant 'stockops-v1'
-- 2) vincula auth_id por email em usuários já existentes
-- 3) cria perfis faltantes em public.users para usuários de auth.users
--
-- Execute no Supabase: Dashboard -> SQL Editor -> cole e execute
-- -----------------------------------------------------------------------------
-- 1) Garantir tenant stockops-v1
-- -----------------------------------------------------------------------------
INSERT INTO public.tenants (name, slug, plan, active)
VALUES ('StockOps 1.0', 'stockops-v1', 'free', true) ON CONFLICT (slug) DO NOTHING;
-- -----------------------------------------------------------------------------
-- 2) Vincular auth_id por email para perfis já existentes
-- -----------------------------------------------------------------------------
UPDATE public.users u
SET auth_id = au.id
FROM auth.users au
WHERE u.email IS NOT NULL
    AND lower(u.email) = lower(au.email)
    AND u.auth_id IS NULL;
-- -----------------------------------------------------------------------------
-- 3) Criar perfis faltantes para usuários do Auth
-- -----------------------------------------------------------------------------
INSERT INTO public.users (
        tenant_id,
        username,
        password_hash,
        role,
        email,
        auth_id
    )
SELECT t.id,
    concat(
        split_part(au.email, '@', 1),
        '_',
        left(au.id::text, 8)
    ) AS username,
    '__supabase_auth__' AS password_hash,
    'viewer' AS role,
    au.email,
    au.id AS auth_id
FROM auth.users au
    CROSS JOIN public.tenants t
    LEFT JOIN public.users pu_auth ON pu_auth.auth_id = au.id
    LEFT JOIN public.users pu_mail ON pu_mail.email IS NOT NULL
    AND lower(pu_mail.email) = lower(au.email)
WHERE t.slug = 'stockops-v1'
    AND pu_auth.id IS NULL
    AND pu_mail.id IS NULL ON CONFLICT DO NOTHING;
-- -----------------------------------------------------------------------------
-- Verificacoes rapidas
-- -----------------------------------------------------------------------------
-- SELECT id, slug, name, plan, active FROM public.tenants WHERE slug = 'stockops-v1';
--
-- SELECT u.id, u.email, u.username, u.tenant_id, u.auth_id
-- FROM public.users u
-- ORDER BY u.created_at DESC
-- LIMIT 20;