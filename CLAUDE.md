# StockOps — Contexto Completo do Projeto

## O Que É o StockOps
IA operacional para prevenção de ruptura de estoque e inteligência de abastecimento. Público-alvo: distribuidoras de médio porte (50–500 SKUs, múltiplos varejistas, sem equipe de dados interna). O produto transforma planilhas de sell-out e estoque em decisões antes que a ruptura aconteça.

**Status atual:** Demo funcional completa na branch `feature`. Branch `main` é produção.

---

## Regras de Trabalho (TODOS OS AGENTES)

1. **Testes obrigatórios antes de qualquer commit** — backend: `cd backend && python -m pytest tests/ -v`; frontend: `npm run build` (não há testes Jest ainda).
2. Trabalhar sempre na branch `feature`. Nunca fazer push direto na `main`.
3. Toda alteração de interface deve ser testada visualmente no servidor local antes de reportar como pronta.
4. Nunca expor chaves de API, JWT secrets ou credenciais em código ou commits.
5. O backend usa Gemini Flash como fallback estático quando a API falha — manter esse padrão.

---

## Arquitetura

```
Upload CSV/Excel
    ↓
FastAPI /analysis/upload
    ↓
data_processor.py  →  load_file · calcular_cobertura · detectar_aceleracao · calcular_impacto
    ↓
ml_engine.py       →  calcular_score · aplicar_classificacao · calcular_curva_abc
    ↓
report_service.py  →  gerar_relatorio (Gemini Flash) · gerar_insight_estatico (fallback)
    ↓
AnalysisSummary (Pydantic) → Frontend Next.js
```

Chatbot: `POST /chat/message` → `chat_service.py` → validação de intenção (sem chamar Gemini fora do domínio) → Gemini Flash → resposta.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Python 3.12 · FastAPI · Pandas · SQLAlchemy · SQLite (MVP) |
| ML | Scikit-learn (score) · XGBoost · Prophet (no requirements, planejado) |
| IA | Google Gemini Flash API (`gemini-1.5-flash`) |
| Frontend | Next.js 16 · Tailwind CSS 4 · TypeScript · Recharts |
| Auth | JWT (python-jose) · bcrypt (passlib) · slowapi (rate limit) |
| Deploy | Vercel (front) · Render (back) · Supabase PostgreSQL (pendente) |

---

## Regras de Negócio Críticas

**Cobertura:** `cobertura_dias = estoque_atual / vendas_diarias`

**Score de Ruptura (0–100):**
- 40% cobertura (0 dias = score máximo; 14+ dias = score mínimo)
- 30% tendência (aceleração = vendas_7d > média + 1.5σ)
- 20% regularidade de abastecimento (padrão 0.3 se não informado)
- 10% sazonalidade (padrão 0.1 se não informada)

**Classificação:** Urgente ≥86 · Ação Recomendada ≥71 · Alerta ≥51 · Monitoramento <51

**Curva ABC (Pareto por perda estimada):** A=80% acumulado · B=80–95% · C=restante

**Impacto financeiro:** `dias_ruptura_projetados × vendas_diarias_ajustadas × preco_medio`

**Reposição sugerida:** `(vendas_diarias × 14) − estoque_atual` (cobertura alvo 14 dias)

---

## Estado Atual — O Que Está Pronto ✅

- Landing page (light theme premium, animações CSS)
- Dashboard 6 tabs: Painel · Ranking · Relatório IA · Estoque · Importar · Cadastrar
- Upload Excel/CSV + pipeline completo de análise
- Score de ruptura 0–100 por SKU
- Curva ABC (Pareto)
- Relatório executivo via Gemini Flash
- Assistente operacional (chatbot com 3 camadas de restrição de domínio)
- CRUD de estoque (InventoryManager) com localStorage
- Histórico de 10 análises (localStorage)
- Export CSV + Export PDF (print)
- JWT Auth + Rate Limiting + CORS + Pydantic + bcrypt
- 26 testes pytest passando
- ERP API: `POST /api/v1/analysis` (JSON direto, sem upload)
- Migration multi-tenant SQL pronta (`db/migrations/001_multi_tenant.sql`)

## Pendente para Produção ⏳

- Supabase PostgreSQL (conta a criar)
- Persistência de usuários no banco (hoje: dict em memória)
- Persistência de inventário no Supabase (hoje: localStorage)
- Virtualização da RiskTable para 1000+ SKUs

---

## Credenciais Locais

- Backend: `http://localhost:8000` | Login: `admin / admin123`
- Frontend: `http://localhost:3000`
- API Docs: `http://localhost:8000/docs`

---

## Estrutura de Arquivos (Relevante)

```
backend/
  main.py                      ← Entry point FastAPI
  routers/analysis.py          ← POST /analysis/upload (pipeline principal)
  routers/auth.py              ← POST /auth/login
  routers/chat.py              ← POST /chat/message
  routers/api_v1.py            ← POST /api/v1/analysis (ERP direto)
  services/data_processor.py   ← Pandas: leitura e processamento
  services/ml_engine.py        ← Score, classificação, curva ABC
  services/report_service.py   ← Gemini relatório + fallback estático
  services/chat_service.py     ← Chatbot: validação domínio + Gemini
  services/ai_insights.py      ← Gemini por SKU individual (não usado no pipeline atual)
  middleware/auth.py            ← JWT + bcrypt + USERS dict
  middleware/rate_limit.py      ← slowapi limiter
  models/schemas.py             ← Pydantic: AnalysisResponse, AnalysisSummary, Token
  db/database.py                ← SQLAlchemy SQLite
  tests/                        ← 26 testes pytest

frontend/
  app/page.tsx                  ← Login
  app/dashboard/page.tsx        ← Dashboard principal (6 tabs)
  components/RiskTable.tsx      ← Ranking com filtros, paginação, export CSV
  components/DashboardCharts.tsx← Recharts: donut, barras, cobertura, ABC
  components/ChatBot.tsx        ← Chatbot flutuante
  components/InventoryManager.tsx← CRUD estoque + histórico movimentos
  components/ManualEntry.tsx    ← Cadastro manual sem Excel
  lib/api.ts                    ← Chamadas HTTP ao backend
  lib/history.ts                ← localStorage: histórico de análises
  lib/inventory.ts              ← localStorage: inventário ativo
  types/analysis.ts             ← TypeScript types
```

---

## Papéis dos Agentes Neste Projeto

**PO (Product Owner):** Decide features, priorização, aceite de entrega. Conhece tech e mercado de varejo/distribuição. Consulte o PO antes de implementar qualquer feature nova.

**Frontend Senior Dev:** Responsável por Next.js 16 + Tailwind 4 + TypeScript. Deve rodar `npm run build` (zero erros TypeScript) antes de todo commit. Não quebrar nenhuma das 6 tabs do dashboard.

**Backend Senior Dev:** Responsável por FastAPI + Pandas + Python 3.12. Deve rodar `python -m pytest tests/ -v` (26/26 passando) antes de todo commit. Manter compatibilidade com o schema `AnalysisSummary`.

**Obsidian (Documentador):** Registra decisões, handoffs e estado atual do projeto no vault `C:\Users\Gabriel\Documents\ObsidianVault\projetos\`. Faz handoff no início de cada sessão para economizar tokens.
