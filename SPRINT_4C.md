# Sprint 4-C — Briefing Oficial
**Data:** 2026-05-21 → atualizado 2026-05-22
**PO:** T2
**Status:** Aberta — Wave 2 adicionada

---

## Contexto

Sprint 4-B entregou 8 features visuais e de cálculo. Sprint 4-C resolve os problemas estruturais de persistência, isolamento de dados e identidade de produto.

---

## Problemas a Resolver

### P1 — Itens cadastrados não persistem no banco
Cadastro via `ManualEntry` / `InventoryManager` salva apenas no `localStorage`.
Ao recarregar ou trocar de dispositivo, os itens somem.
**Critério:** Todo `POST` de cadastro de item deve gravar em `inventory_items` no Supabase.

### P2 — Itens não são isolados por usuário (tenant)
O sistema trata itens como globais. Usuário A enxerga os itens do Usuário B.
A migration `001_multi_tenant.sql` já garante `tenant_id` nas tabelas — falta o backend filtrar por tenant e o frontend deixar de usar `localStorage` como fonte de verdade.
**Critério:** Cada usuário só vê e edita os próprios itens. RLS + filtro `tenant_id` obrigatório.

### P3 — Re-análise cria entrada duplicada no histórico
Quando o usuário roda uma nova análise sobre o mesmo estoque, o sistema empilha um novo registro em vez de atualizar o existente.
**Critério:** Se já existe uma análise para aquele `tenant_id` (mesmo usuário/estoque), a análise deve ser **atualizada** (`updated_at` + novo `result_json`). Novo registro só para tenant diferente ou primeiro upload.

### P4 — Histórico não carrega os itens daquela análise
Ao abrir uma análise antiga no histórico, os itens exibidos são os do `localStorage` atual — não os que existiam naquele momento.
**Critério:** Cada análise salva um snapshot dos itens (`items_snapshot JSONB`) no momento da análise. Ao carregar do histórico, o frontend exibe esse snapshot.

### P5 — EAN obrigatório no cadastro / coluna no ranking
No formulário de cadastro não existe campo EAN. No ranking (`RiskTable`) a coluna "Código do Produto" precisa do EAN.
**Critério:** Campo `ean` obrigatório no formulário de cadastro. Coluna EAN visível no ranking.

---

## Features da Sprint 4-C

| # | Feature | Responsável | Depende de |
|---|---|---|---|
| C1 | Persistência de itens no Supabase (sair do localStorage) | T4 + T5 | — |
| C2 | Isolamento de itens por tenant (multi-tenant ativo) | T4 | C1 |
| C3 | Análise atualiza registro existente (não duplica) | T4 | C1, C2 |
| C4 | Histórico carrega snapshot de itens da análise | T4 + T3 | C3 |
| C5 | EAN obrigatório no cadastro + coluna no ranking | T3 + T4 | C1 |

**Ordem obrigatória:** C1 → C2 → C3 → C4 e C5 em paralelo.

---

## Briefing por Agente

---

### T5 — DB Architect

**Migration 004 — Adicionar campo `ean` em `inventory_items`**

```sql
-- 004_add_ean_to_inventory.sql
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS ean VARCHAR(14);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS nome VARCHAR(255);
-- EAN e nome são NOT NULL para novos registros, nullable para compatibilidade com dados existentes
```

**Migration 005 — Adicionar `items_snapshot` e `updated_at` em `analyses`**

```sql
-- 005_analyses_snapshot.sql
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS items_snapshot JSONB;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
```

**Regras:**
- Executar no Supabase SQL Editor na ordem: 004 → 005
- Informar T4 após execução com os nomes exatos das colunas
- Não alterar `inventory_items` além dessas colunas — `sku`, `loja`, `tenant_id` permanecem intactos
- `UNIQUE(tenant_id, sku, loja)` continua valendo

---

### T4 — Backend Dev

**C1 — Endpoints de inventário no Supabase**

Criar `routers/inventory.py` com:
- `GET /inventory/items` → lista itens do tenant autenticado
- `POST /inventory/items` → cria item (campos: `sku`, `nome`, `ean` obrigatório, `loja`, `categoria`, `estoque_atual`, `vendas_diarias`, `preco_medio`, `data_validade` opcional)
- `PUT /inventory/items/{id}` → atualiza item do tenant
- `DELETE /inventory/items/{id}` → remove item do tenant

Todos os endpoints:
- `Depends(get_current_user)` — JWT obrigatório
- Filtro `.eq("tenant_id", current_user.tenant_id)` em toda query
- Rate limit decorator
- Pydantic validation

**C2 — Isolamento por tenant**

O `get_current_user` em `middleware/auth.py` hoje usa `USERS` dict em memória.
Para Sprint 4-C, o token JWT deve carregar `tenant_id`.
Adicionar `tenant_id` no payload do JWT gerado em `POST /auth/login`.
O `get_current_user` deve retornar objeto com `user_id` e `tenant_id`.

**C3 — Análise upsert (não duplica)**

Em `routers/analysis.py`, após o pipeline completar:
- Verificar se existe análise para `tenant_id` em `analyses`
- Se existe: `UPDATE analyses SET result_json=..., updated_at=NOW(), items_snapshot=... WHERE tenant_id=...`
- Se não existe: `INSERT INTO analyses (...)`
- O `items_snapshot` deve ser a lista atual de `inventory_items` do tenant no momento da análise

**C4 — Endpoint para buscar análise com snapshot**

- `GET /analyses/current` → retorna a análise atual do tenant + `items_snapshot`
- Frontend usa `items_snapshot` ao carregar histórico

**C5 — Schema: EAN obrigatório**

Em `models/schemas.py`, no modelo de item de inventário:
- Adicionar campo `ean: str` (obrigatório)
- Adicionar campo `nome: str` (obrigatório)

Rodar `python -m pytest tests/ -v` — todos os 77 testes devem passar antes do commit.

---

### T3 — Frontend Dev

**Atenção:** Abrir sessão nova antes de iniciar. Rodar `npm run build --prefix frontend` zero erros antes de reportar qualquer feature como pronta.

**C1 — InventoryManager / ManualEntry: salvar via API**

Substituir chamadas a `localStorage` por chamadas à API:
- `POST /inventory/items` ao cadastrar
- `GET /inventory/items` ao carregar lista
- `PUT /inventory/items/{id}` ao editar
- `DELETE /inventory/items/{id}` ao remover
Remover dependência de `lib/inventory.ts` (localStorage) para os itens principais.

**C4 — Histórico: carregar snapshot da análise**

Ao selecionar uma análise no histórico:
- Buscar `GET /analyses/current` (ou histórico expandido)
- Exibir `items_snapshot` daquela análise — não os itens do localStorage atual

**C5 — ManualEntry / InventoryManager: campo EAN**

- Adicionar campo `ean` (obrigatório, `required`) no formulário de cadastro
- Adicionar campo `nome` (obrigatório) se ainda não existir separado do `sku`
- Em `RiskTable.tsx`: adicionar coluna "EAN" ao lado de "Código/SKU" e "Nome"

---

---

## Wave 2 — Adições 2026-05-22

---

### B1 — Bug: contador da aba Estoque não atualiza
**Agente:** T3
**Arquivo provável:** `app/dashboard/page.tsx` — o badge numérico na tab "Estoque" não reage quando um item é adicionado/removido via `InventoryManager`.
**Critério:** Adicionar item → contador incrementa imediatamente. Remover item → decrementa. Sem reload.

---

### F8 — Múltiplos estoques por tenant

**Contexto:** Hoje cada tenant tem um inventário único global. O usuário precisa de N estoques nomeados, podendo alternar entre eles na aba Estoque e escolher qual usar para gerar a análise.

**Três tipos de estoque:**

| Tipo | Origem | Estado inicial |
|---|---|---|
| Estoque Ativo | Itens cadastrados/importados manualmente | Items existentes do tenant |
| Estoque de Análise | Carregado do `items_snapshot` de uma análise passada | Read-only (snapshot) |
| Estoque Novo | Criado do zero pelo usuário | Vazio, zero itens |

**Nome:** campo aberto opcional. Se vazio, usa `Estoque · {data hora}` como padrão.

#### T5 — Migration 006

Criar tabela `inventories` para agrupar estoques por tenant:

```sql
-- 006_inventories.sql
CREATE TABLE IF NOT EXISTS inventories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL DEFAULT 'Estoque',
    type        VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (type IN ('manual', 'snapshot', 'empty')),
    source_analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS inventory_id UUID REFERENCES inventories(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_inventories_tenant ON inventories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_inventory ON inventory_items(inventory_id);

ALTER TABLE inventories ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON inventories
    USING (tenant_id = current_setting('app.tenant_id')::UUID);
```

Após executar: avisar T4 com os nomes exatos das colunas.
Migrar registros existentes: criar um inventory padrão para o tenant demo e associar todos os `inventory_items` existentes a ele.

#### T4 — Backend

**Novos endpoints em `routers/inventory.py`:**
- `GET /inventories` → lista estoques do tenant (id, name, type, created_at, contagem de itens)
- `POST /inventories` → cria estoque (name opcional, type: manual|empty)
- `DELETE /inventories/{id}` → remove estoque e seus itens
- `POST /inventories/{id}/activate` → define estoque ativo na sessão (ou via query param)

**Ajustar endpoints existentes:**
- `GET /inventory/items` → aceitar `?inventory_id=` para filtrar por estoque
- `POST /inventory/items` → exigir `inventory_id` no body
- `PUT /inventory/items/{id}` / `DELETE /inventory/items/{id}` → validar que item pertence ao tenant

**Ao criar análise (C3 — save_analysis):**
- Receber `inventory_id` do frontend
- Salvar `items_snapshot` com os itens daquele inventory_id específico (não todos do tenant)

**Schema Pydantic em `models/schemas.py`:**
```python
class InventoryCreate(BaseModel):
    name: Optional[str] = None
    type: str = "manual"

class InventoryResponse(BaseModel):
    id: str
    name: str
    type: str
    item_count: int
    created_at: str
```

Rodar `python -m pytest tests/ -v` — 84/84 antes de reportar.

#### T3 — Frontend

**Seletor de estoque em `InventoryManager.tsx`:**
- Dropdown/select no topo da aba listando os estoques do tenant (`GET /inventories`)
- Botão "+ Novo Estoque" abre modal com campo de nome (opcional)
- Ao trocar de estoque: recarregar itens com `GET /inventory/items?inventory_id=X`
- Estoque de análise (type=snapshot): exibir banner "Snapshot · read-only", desabilitar edição

**Ao gerar análise:**
- Passar `inventory_id` do estoque selecionado na chamada ao backend

**B1 — Contador da aba:**
- O badge numérico na tab "Estoque" deve ser derivado do `items.length` do estado atual
- Atualizar sempre que a lista de itens mudar (add/remove/load)

---

### F9 — Remover chatbot

**T3:**
- Remover `<ChatBot />` e seu import de `app/dashboard/page.tsx`
- Remover o botão flutuante do chat de todas as telas
- Remover menção ao chatbot na landing page `app/page.tsx` se existir
- **Não deletar** `components/ChatBot.tsx` — apenas desmontar da UI (preservar para reuso futuro)

**T4:**
- Endpoint `POST /chat/message` permanece no backend (não quebra nada, pode ser reativado)
- Nenhuma alteração necessária

---

## Critério de Aceite da Sprint 4-C

Uma feature está pronta quando:
1. `python -m pytest tests/ -v` → 84/84 passando (backend)
2. `npm run build --prefix frontend` → zero erros TypeScript (frontend)
3. Fluxo testado no localhost: cadastrar item → rodar análise → verificar que item persiste após reload
4. Dois usuários distintos não enxergam os itens um do outro
5. Segunda análise do mesmo usuário atualiza o registro existente (não cria duplicata)
6. Múltiplos estoques: criar novo → vazio; selecionar análise → read-only; alternar → itens corretos
7. Chatbot não aparece em nenhuma tela
8. Contador da aba Estoque atualiza em tempo real
9. Documentado no handoff do Obsidian (T1)

---

## Arquivos Críticos

```
backend/
  routers/inventory.py        ← NOVO (C1)
  routers/analysis.py         ← MODIFICAR (C3)
  middleware/auth.py          ← MODIFICAR (C2 — tenant_id no JWT)
  models/schemas.py           ← MODIFICAR (C5 — EAN + nome)
  db/migrations/004_*.sql     ← NOVO (T5)
  db/migrations/005_*.sql     ← NOVO (T5)

frontend/
  components/ManualEntry.tsx       ← MODIFICAR (C1, C5)
  components/InventoryManager.tsx  ← MODIFICAR (C1, C5)
  components/RiskTable.tsx         ← MODIFICAR (C5 — coluna EAN)
  lib/api.ts                       ← MODIFICAR (C1 — novos endpoints)
```

---

---

## T3 — Ordem F8 (ajuste final, 2026-05-22)

**Contexto:** T4 entregou CRUD completo de inventários no Supabase. O seletor implementado usa `snapshotHistory` do localStorage — precisa migrar para a API.

### 1. `lib/api.ts` — adicionar

```ts
export async function getInventories(): Promise<InventoryResponse[]> {
  const res = await apiFetch("/inventories")
  if (!res.ok) return []
  return res.json()
}

export async function createInventory(name?: string): Promise<InventoryResponse> {
  const res = await apiFetch("/inventories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name || null, type: "manual" }),
  })
  return res.json()
}

export async function activateInventory(id: string): Promise<void> {
  await apiFetch(`/inventories/${id}/activate`, { method: "POST" })
}

export async function deleteInventory(id: string): Promise<void> {
  await apiFetch(`/inventories/${id}`, { method: "DELETE" })
}
```

### 2. `types/analysis.ts` — adicionar tipo

```ts
export interface InventoryResponse {
  id: string
  name: string
  type: "manual" | "snapshot" | "empty"
  item_count: number
  created_at: string
}
```

### 3. `InventoryManager.tsx` — substituir seletor local

- **Ao montar:** `getInventories()` → preenche `<select>` com os estoques do tenant
- **Ao selecionar estoque:** `activateInventory(id)` + recarregar itens com `GET /inventory/items?inventory_id=id`
- **Botão "Novo Estoque":** abre modal com campo nome (opcional) → `createInventory(nome)` → ativa → lista vazia
- **Estoques `type=snapshot`:** exibir banner "Snapshot · read-only", desabilitar add/edit/delete
- **Remover** dependência de `snapshotHistory` do localStorage para popular o seletor

### 4. Ao gerar análise

Passar `inventory_id` do estoque ativo na chamada `POST /analysis/upload?inventory_id=X`

### Critério de aceite

1. `npm run build --prefix frontend` → zero erros
2. Fluxo: criar novo estoque → vazio → cadastrar item → gerar análise → trocar para outro estoque → itens diferentes
3. Estoque de snapshot → read-only confirmado
4. Não quebrar B1 (badge) nem F9 (chatbot removido)

---

## O Que NÃO Fazer

- Não remover o `localStorage` de histórico de análises (apenas os itens migram para banco)
- Não quebrar nenhuma das 6 tabs do dashboard
- Não alterar o pipeline de análise (`data_processor`, `ml_engine`) — só a camada de persistência
- Não criar novo tenant por análise — tenant = usuário/empresa, não por upload
