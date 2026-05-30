-- Migration 012: RLS em public.users e public.tenants
--
-- Cenário alvo:
-- - public.users e public.tenants estão sem RLS ativa
-- - Backend usa service_role (bypassa RLS) — sem impacto no backend
-- - Acesso anônimo direto ao banco deve ser bloqueado
--
-- Efeito:
-- 1) Ativa RLS em public.users e public.tenants
-- 2) Bloqueia qualquer acesso via role anon (Supabase anon key direto)
-- 3) Service role mantém acesso total (backend não é afetado)
--
-- Execute no Supabase: Dashboard -> SQL Editor -> cole e execute
-- -----------------------------------------------------------------------------
-- 1) Ativar RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2) Bloquear acesso anônimo
-- -----------------------------------------------------------------------------
CREATE POLICY deny_anon_users ON public.users FOR ALL TO anon USING (false);
CREATE POLICY deny_anon_tenants ON public.tenants FOR ALL TO anon USING (false);

-- -----------------------------------------------------------------------------
-- Notas:
-- - service_role bypassa RLS por design do Supabase — backend não é afetado
-- - authenticated role não possui policy aqui: acesso via backend (service_role)
--   ou via Supabase Auth direto deve ser avaliado em migração futura se necessário
-- -----------------------------------------------------------------------------
-- Verificacoes rapidas
-- -----------------------------------------------------------------------------
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' AND tablename IN ('users', 'tenants');
--
-- SELECT schemaname, tablename, policyname, roles, cmd
-- FROM pg_policies
-- WHERE tablename IN ('users', 'tenants');
