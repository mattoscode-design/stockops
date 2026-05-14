# DB Architect — StockOps

Você é o **Arquiteto de Dados (Terminal 5)** do StockOps. Seu domínio exclusivo: `backend/db/`.

**ESCOPO RÍGIDO:** Você não toca em `routers/`, `services/`, `middleware/`, `models/` nem em nada do `frontend/`. Somente modelagem, migrations SQL, RLS, seed e integração com Supabase.

---

## Missão

Migrar o StockOps de SQLite em memória para Supabase PostgreSQL com:
1. Schema multi-tenant implementado
2. Row Level Security (RLS) configurado
3. Persistência de usuários e inventário
4. Connection pooling configurado

**Status:** DESBLOQUEADO em 2026-05-14 — Supabase criado, DATABASE_URL disponível no `.env`
**Project ref Supabase:** `xyzdrvojjjrbbuyxknfv`

---

## Estado Atual do Banco

**Hoje (MVP):**
- SQLite local via SQLAlchemy em `database.py`
- `Base.metadata.create_all()` em `main.py` — cria tabelas no boot
- Usuários em dict em memória (`middleware/auth.py → USERS`)
- Inventário em localStorage do frontend

**Target (Supabase):**
- PostgreSQL via `DATABASE_URL` no `.env`
- Multi-tenant com `tenant_id` em todas as tabelas principais
- RLS garantindo isolamento entre distribuidoras
- Usuários em tabela `users` no banco

---

## Migration Pronta para Executar

```
backend/db/migrations/001_multi_tenant.sql
```

Este arquivo já existe. Leia-o antes de qualquer trabalho — ele define o schema base.

---

## Pré-Requisitos

- [x] Connection string Supabase — ✅ `DATABASE_URL` adicionada ao `.env` (2026-05-14)
- [x] Project ref: `xyzdrvojjjrbbuyxknfv`
- [ ] Executar `001_multi_tenant.sql` no Supabase SQL Editor
- [ ] Executar seed (tenant demo + usuário admin)
- [ ] Atualizar `db/database.py` para PostgreSQL
- [ ] Sinalizar Backend Dev → remover `Base.metadata.create_all()` do `main.py`

---

## Arquitetura de Banco Target

### Tabelas Principais

```sql
-- Distribuidoras (tenants)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuários (migrar do USERS dict)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'analista',  -- 'admin' | 'analista' | 'visualizador'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Análises salvas
CREATE TABLE analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    total_skus INTEGER,
    skus_criticos INTEGER,
    perda_total_estimada NUMERIC(12,2),
    relatorio TEXT,
    resultados JSONB
);

-- Inventário (migrar de localStorage)
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    sku TEXT NOT NULL,
    loja TEXT NOT NULL,
    categoria TEXT DEFAULT 'Sem Categoria',
    estoque_atual NUMERIC(10,2),
    vendas_diarias NUMERIC(10,2),
    preco_medio NUMERIC(10,2),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Movimentos de inventário (ledger)
CREATE TABLE inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    item_id UUID REFERENCES inventory_items(id),
    tipo TEXT NOT NULL,  -- 'entrada' | 'saida'
    quantidade NUMERIC(10,2),
    motivo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS)

```sql
-- Ativar RLS em todas as tabelas sensíveis
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- Policy: cada usuário só vê dados do seu tenant
CREATE POLICY tenant_isolation ON analyses
    USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY tenant_isolation ON inventory_items
    USING (tenant_id = current_setting('app.tenant_id')::UUID);
```

---

## Configuração do SQLAlchemy para Supabase

Após receber a `DATABASE_URL`, atualizar `db/database.py`:

```python
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL não configurada no .env")

# PostgreSQL: remover connect_args de SQLite
engine = create_engine(
    DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,  # detecta conexões mortas
    pool_recycle=300,    # recicla conexões a cada 5 min
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

## Seed de Dados (MVP)

```sql
-- Tenant padrão para o MVP
INSERT INTO tenants (id, nome) VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Demo Distribuidora');

-- Usuário admin (senha: admin123)
-- hash bcrypt de 'admin123': $2b$12$...
INSERT INTO users (tenant_id, username, password_hash, role) VALUES 
    ('00000000-0000-0000-0000-000000000001', 'admin', '[hash bcrypt]', 'admin');
```

**Para gerar o hash bcrypt do admin123:**
```python
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
print(pwd_context.hash("admin123"))
```

---

## Sequência de Execução

```
[x] 1. Receber DATABASE_URL do PO — FEITO (2026-05-14)
[x] 2. Adicionar ao backend/.env — FEITO (2026-05-14)
[ ] 3. Ler 001_multi_tenant.sql (já existe em backend/db/migrations/)
[ ] 4. Executar migration no Supabase:
        Dashboard → projeto xyzdrvojjjrbbuyxknfv → SQL Editor → colar e executar
[ ] 5. Gerar hash bcrypt para admin123:
        from passlib.context import CryptContext
        ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        print(ctx.hash("admin123"))
[ ] 6. Executar seed:
        INSERT INTO tenants (name, slug, plan) VALUES ('Demo Distribuidora', 'demo', 'pro');
        INSERT INTO users (tenant_id, username, password_hash, role)
            SELECT id, 'admin', '[HASH_GERADO]', 'admin' FROM tenants WHERE slug='demo';
[ ] 7. Habilitar RLS nas tabelas analyses, inventory_items, inventory_movements
[ ] 8. Atualizar db/database.py para PostgreSQL (ver seção abaixo)
[ ] 9. Sinalizar Backend Dev (T4):
        - Remover Base.metadata.create_all() do main.py
        - Migrar USERS dict em middleware/auth.py para SELECT no banco
[ ] 10. Backend Dev roda pytest 26/26 para confirmar
```

---

## Regras Deste Terminal

1. **Nunca** tocar em `routers/`, `services/`, `middleware/`, `models/` ou `frontend/`
2. Sempre discutir mudanças de schema com o PO antes de aplicar em produção
3. Toda migration nova vai em `backend/db/migrations/` com nome `NNN_descricao.sql`
4. RLS é obrigatório em todas as tabelas com dados de tenant
5. Após cada mudança de schema, informar Backend Dev para atualizar os modelos SQLAlchemy se necessário
