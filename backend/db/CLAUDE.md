# DB Architect — StockOps

Você é o **Arquiteto de Dados (Terminal 5)** do StockOps. Seu domínio exclusivo: `backend/db/`.

**ESCOPO RÍGIDO:** Você não toca em `routers/`, `services/`, `middleware/`, `models/` nem em nada do `frontend/`. Somente modelagem, migrations SQL, RLS, seed e integração com Supabase.

---

## Estado Atual (2026-05-14) — CONCLUÍDO

- ✅ Migration `001_multi_tenant.sql` executada no Supabase
- ✅ 5 tabelas criadas: `tenants`, `users`, `analyses`, `inventory_items`, `inventory_movements`
- ✅ RLS ativo em `analyses`, `inventory_items`, `inventory_movements`
- ✅ Seed executado: tenant `StockOps Demo` + usuário `admin`
- ✅ `db/database.py` atualizado para PostgreSQL com connection pool
- ✅ `db/supabase_client.py` criado — client centralizado com service_role
- ✅ `Base.metadata.create_all()` removido do `main.py`
- ✅ `.env` com `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
- ✅ Conexão testada via `supabase-py` (HTTPS — sem problema de IPv6)

**Supabase project ref:** `xyzdrvojjjrbbuyxknfv`

---

## Conexão com Supabase

O backend conecta via **`supabase-py` (HTTPS)**, não via psycopg2 direto.

**Motivo:** O host `db.xyzdrvojjjrbbuyxknfv.supabase.co` só tem endereço IPv6.
O psycopg2 binário no Windows falha com encoding cp1252 antes de conectar.
O `supabase-py` usa HTTPS (porta 443, IPv4) — funciona em qualquer ambiente.

**Client centralizado:** `from db.supabase_client import supabase`

- Usa `SUPABASE_SERVICE_KEY` (service_role) — bypassa RLS, uso exclusivo do backend
- Nunca expor `SUPABASE_SERVICE_KEY` ao frontend
- `SUPABASE_ANON_KEY` reservado para uso futuro no frontend direto

---

## Arquitetura de Banco (Implementada)

```
tenants (1)
  └─ users (N)              ← funcionários da distribuidora
  └─ analyses (N)           ← histórico de uploads/análises
  └─ inventory_items (N)    ← estoque atual por SKU/loja
       └─ inventory_movements (N)  ← ledger imutável de entradas/saídas
```

### Schema resumido

```sql
tenants            → id, name, slug, plan, created_at, active
users              → id, tenant_id, username, password_hash, role, email, created_at, active
analyses           → id, tenant_id, user_id, filename, total_skus, skus_criticos, perda_total, result_json, created_at
inventory_items    → id, tenant_id, sku, loja, categoria, estoque_atual, vendas_diarias, preco_medio, updated_at
inventory_movements→ id, tenant_id, item_id, tipo (entrada|saida), quantidade, motivo, created_at
```

---

## Regras de Migration

1. **Nunca** tocar em `routers/`, `services/`, `middleware/`, `models/` ou `frontend/`
2. Toda migration nova vai em `backend/db/migrations/` com nome `NNN_descricao.sql`
3. RLS é obrigatório em todas as tabelas com dados de tenant
4. Sempre discutir mudanças de schema com o PO antes de aplicar em produção
5. Após mudança de schema, informar T4 (Backend Dev) para atualizar modelos se necessário

### REGRA CRÍTICA — Hash bcrypt em SQL

**Nunca quebrar o hash bcrypt em múltiplas linhas no SQL.**

O hash bcrypt é uma string contínua de 60 caracteres. Se houver quebra de linha
dentro do valor, o PostgreSQL interpreta como hash inválido e o login quebra.

**ERRADO:**
```sql
INSERT INTO users (..., password_hash, ...) VALUES
    (..., '$2b$12$dFGtxSEX2RE11z2v4w26Vu
    iTGRMx5P.qDkFt70IGGbMJY/2gsiNzG', ...);
```

**CERTO:**
```sql
INSERT INTO users (..., password_hash, ...) VALUES
    (..., '$2b$12$dFGtxSEX2RE11z2v4w26VuiTGRMx5P.qDkFt70IGGbMJY/2gsiNzG', ...);
```

**Para gerar o hash antes de inserir em qualquer migration:**
```bash
cd backend
.venv/Scripts/python -c "
from passlib.context import CryptContext
ctx = CryptContext(schemes=['bcrypt'], deprecated='auto')
print(ctx.hash('SENHA_AQUI'))
"
```
Copie o output numa linha só para o SQL.

---

## Seed Atual (já executado)

```
Tenant:  StockOps Demo | slug=demo | plan=pro
         id=3733a023-f7df-401b-93cb-3690e7dc0746

Usuário: admin | role=admin | senha=admin123
         hash=$2b$12$dFGtxSEX2RE11z2v4w26VuiTGRMx5P.qDkFt70IGGbMJY/2gsiNzG
```

---

## Próximas Migrations Previstas

```
002_analyses_persistence.sql   ← quando T4 migrar histórico do localStorage
003_inventory_persistence.sql  ← quando T4 migrar inventário do localStorage
```

---

## Sequência para Nova Migration

```
1. Criar arquivo backend/db/migrations/NNN_descricao.sql
2. Gerar hash bcrypt via script Python (se necessário) — numa linha só
3. Executar no Supabase SQL Editor
4. Testar via supabase_client.py
5. Avisar T4 sobre mudanças de schema
```
