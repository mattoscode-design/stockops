# StockOps — Documentação Técnica

**IA Operacional para Prevenção de Ruptura e Inteligência de Abastecimento**

**Status:** Demo funcional completa · Deploy pendente (Supabase + Render + Vercel)

---

## Estado Atual — O Que Está Pronto

| Módulo | Status |
|---|---|
| Landing page (light theme + animações) | ✅ |
| Dashboard com 6 tabs | ✅ |
| Upload Excel/CSV + análise | ✅ |
| Cadastro manual de estoque | ✅ |
| **Gestão de Estoque CRUD** | ✅ |
| Score de ruptura 0–100 | ✅ |
| Curva ABC (Pareto) | ✅ |
| Relatório executivo IA (Gemini Flash) | ✅ |
| Assistente operacional (chatbot) | ✅ |
| Gráficos (donut, barras, cobertura, ABC) | ✅ |
| Ranking com paginação + filtros + debounce | ✅ |
| Export CSV + Export PDF (print) | ✅ |
| Histórico de análises (localStorage) | ✅ |
| Demo automática ao entrar | ✅ |
| 26 testes automatizados | ✅ |
| ERP API (POST /api/v1/analysis via JSON) | ✅ |
| Migration multi-tenant (SQL pronto) | ✅ |
| Toast notifications | ✅ |
| Gráfico de tendência de estoque por SKU | ✅ |
| Persistência no Supabase | ⏳ (conta a criar) |
| Usuários no banco | ⏳ (hoje em memória) |

---

## Visão Geral

O StockOps é uma plataforma que transforma planilhas de estoque e sell-out em decisões operacionais antes que a ruptura aconteça. O sistema detecta anomalias, calcula probabilidade de ruptura e entrega recomendações em linguagem de negócio via IA generativa.

**Stack:** Python 3.12 · FastAPI · Pandas · Scikit-learn · XGBoost · Prophet · Gemini Flash API · Next.js 16 · Tailwind 4 · TypeScript

---

## Assistente Operacional (Chatbot IA)

O StockOps possui um chatbot integrado ao Gemini Flash API com **contexto restrito ao domínio operacional**.

### Arquitetura de restrição

| Camada | Implementação |
|---|---|
| System Prompt fixo | Persona de "Analista Operacional StockOps" com regras rígidas de domínio |
| Validação de intenção | Keywords do domínio checadas antes de chamar o Gemini — sem gasto de token para perguntas fora do escopo |
| Contexto injetado | Top 5 SKUs por risco + métricas da análise passados em cada prompt |
| Perguntas guiadas | Frontend gera sugestões baseadas nos dados reais carregados |

### Fluxo do chatbot

```
Usuário clica numa pergunta sugerida (ou digita)
    ↓
Frontend envia { question, context: AnalysisResult }
    ↓
Backend valida intenção (domain keywords)
    ↓ se fora do escopo → retorna mensagem padrão sem chamar Gemini
    ↓ se dentro do escopo → injeta contexto no system prompt
    ↓
Gemini Flash gera resposta em linguagem de negócio
    ↓
Frontend exibe no painel de chat
```

### Perguntas sugeridas (geradas dinamicamente)

- "Qual SKU tem maior risco de ruptura agora?" — sempre presente
- "Quais lojas devo priorizar para reposição hoje?" — sempre presente
- "Qual é a situação do {top_sku}?" — preenchida com SKU mais crítico real
- "Como está a perda estimada total desta análise?" — sempre presente
- "Por que {sku_crítico} está em estado {classificacao}?" — se há críticos
- "Quais os 3 SKUs mais urgentes desta semana?" — se há mais de 3 resultados

### Validação de intenção — lógica refinada

```python
# Passa se tiver pelo menos 1 substantivo do domínio
DOMAIN_NOUNS = {"sku", "loja", "estoque", "ruptura", "categoria", ...}

# OU pelo menos 2 palavras de contexto
DOMAIN_CONTEXT = {"risco", "perda", "urgente", "crítico", "reposição", ...}

def _is_in_scope(question):
    words = set(question.lower().split())
    has_noun = bool(words & DOMAIN_NOUNS)
    context_count = len(words & DOMAIN_CONTEXT)
    return has_noun or context_count >= 2
```

Isso impede frases como *"Me dê uma receita urgente"* de passarem só por conter "urgente".

### Arquivos

| Arquivo | Função |
|---|---|
| `backend/services/chat_service.py` | `responder(question, summary)` — validação refinada + logging + contexto com categorias |
| `backend/routers/chat.py` | `POST /chat/message` — async, rate limit 20/min, validação via `AnalysisSummary` |
| `frontend/components/ChatBot.tsx` | UI flutuante — `useMemo`, `crypto.randomUUID()`, timeout 15s, botão copiar, perguntas por categoria |
| `frontend/components/HistoryPanel.tsx` | Dropdown com fechar ao clicar fora, nome gerado automaticamente, sem campos duplicados |
| `frontend/lib/history.ts` | `saveToHistory`, `loadHistory`, `clearHistory` — `crypto.randomUUID()`, quota guard |

**Custo de infraestrutura:** R$ 0,00

---

## Estrutura do Projeto

```
stockops/
├── backend/
│   ├── main.py                  ← Entrada da API
│   ├── requirements.txt
│   ├── .env.example
│   ├── routers/
│   │   ├── auth.py              ← POST /auth/login
│   │   └── analysis.py          ← POST /analysis/upload
│   ├── services/
│   │   ├── data_processor.py    ← Pandas: leitura e processamento
│   │   ├── ml_engine.py         ← Score de ruptura 0-100
│   │   └── ai_insights.py       ← Gemini Flash: insights e recomendações
│   ├── middleware/
│   │   ├── auth.py              ← JWT: criação e validação
│   │   └── rate_limit.py        ← slowapi: 30 req/min
│   ├── models/
│   │   └── schemas.py           ← Pydantic: validação de entrada e saída
│   └── db/
│       └── database.py          ← SQLite via SQLAlchemy
├── frontend/
│   ├── app/
│   │   ├── layout.tsx           ← Layout raiz
│   │   ├── page.tsx             ← Página de login
│   │   ├── globals.css          ← Design system (variáveis CSS)
│   │   └── dashboard/
│   │       └── page.tsx         ← Dashboard principal
│   └── components/
│       ├── Navbar.tsx           ← Barra de navegação
│       ├── UploadZone.tsx       ← Zona de upload drag & drop
│       ├── SummaryCards.tsx     ← Cards de métricas
│       └── RiskTable.tsx        ← Tabela de ranking com insights
└── demo_dados.csv               ← Dados mockados para demonstração
```

---

## Backend — Funções por Arquivo

### `main.py`
| Elemento | Descrição |
|---|---|
| `app` | Instância FastAPI com CORS, rate limiter e routers registrados |
| `Base.metadata.create_all` | Cria tabelas SQLite na inicialização |

### `routers/auth.py`
| Função | Rota | Descrição |
|---|---|---|
| `login(data)` | `POST /auth/login` | Valida credenciais e retorna JWT |

### `routers/analysis.py`
| Função | Rota | Descrição |
|---|---|---|
| `upload_and_analyze(request, file, current_user)` | `POST /analysis/upload` | Recebe planilha, processa pelo pipeline completo e retorna AnalysisSummary |

### `services/data_processor.py`
| Função | Parâmetros | Retorno | Descrição |
|---|---|---|---|
| `load_file(file_bytes, filename)` | bytes, str | DataFrame | Lê Excel ou CSV, normaliza colunas, valida obrigatórias |
| `calcular_cobertura(df)` | DataFrame | DataFrame | `cobertura_dias = estoque_atual / vendas_diarias` |
| `detectar_aceleracao(df)` | DataFrame | DataFrame | Compara vendas_7d com média ± 1.5 desvio padrão |
| `calcular_impacto(df, cobertura_alvo=14)` | DataFrame, int | DataFrame | Calcula perda_estimada_reais e quantidade_recomendada |

### `services/ml_engine.py`
| Função | Parâmetros | Retorno | Descrição |
|---|---|---|---|
| `calcular_score(df)` | DataFrame | DataFrame | Score 0-100: 40% cobertura + 30% tendência + 20% abastecimento + 10% sazonalidade |
| `classificar_risco(score)` | float | str | 86-100 Urgente · 71-85 Ação Recomendada · 51-70 Alerta · 0-50 Monitoramento |
| `aplicar_classificacao(df)` | DataFrame | DataFrame | Aplica `classificar_risco` em todo o DataFrame |

### `services/ai_insights.py`
| Função | Parâmetros | Retorno | Descrição |
|---|---|---|---|
| `gerar_insight(sku, loja, score, cobertura, classificacao, perda, quantidade, aceleracao)` | múltiplos | tuple[str, str] | Chama Gemini Flash e retorna (insight, recomendacao) em linguagem de negócio |

### `middleware/auth.py`
| Função | Parâmetros | Retorno | Descrição |
|---|---|---|---|
| `verify_password(plain, hashed)` | str, str | bool | Verifica senha via bcrypt |
| `create_token(data)` | dict | str | Gera JWT com expiração configurável |
| `get_current_user(token)` | str | dict | Decodifica e valida JWT, retorna username e role |

### `middleware/rate_limit.py`
| Elemento | Descrição |
|---|---|
| `limiter` | Instância slowapi com limite de 30 req/min por IP |

### `models/schemas.py`
| Schema | Campos | Descrição |
|---|---|---|
| `AnalysisResponse` | sku, loja, cobertura_dias, score_ruptura, classificacao, perda_estimada_reais, quantidade_recomendada, insight, recomendacao | Resultado por SKU |
| `AnalysisSummary` | total_skus, skus_criticos, perda_total_estimada, resultados | Resultado completo da análise |
| `Token` | access_token, token_type | Resposta do login |
| `UserLogin` | username, password | Dados de autenticação |

---

## Frontend — Funções por Componente

### `app/page.tsx` — Login
| Função | Descrição |
|---|---|
| `handleLogin(e)` | POST /auth/login, salva JWT no localStorage, redireciona para /dashboard |

### `app/dashboard/page.tsx` — Dashboard
| Função / Hook | Descrição |
|---|---|
| `useEffect` | Verifica token no localStorage, decodifica JWT para extrair username |
| `reset()` | Limpa resultado e volta ao estado de upload |

### `components/Navbar.tsx`
| Função | Descrição |
|---|---|
| `logout()` | Remove token do localStorage e redireciona para login |

### `components/UploadZone.tsx`
| Função | Descrição |
|---|---|
| `upload(file)` | Valida tipo (.xlsx/.csv) e tamanho (10MB), faz POST /analysis/upload com Bearer token |
| `onDragOver / onDrop` | Handlers de drag & drop para receber arquivo |

### `components/RiskTable.tsx`
| Função | Descrição |
|---|---|
| `scoreColor(score)` | Retorna cor CSS baseada na faixa: vermelho ≥86, laranja ≥71, amarelo ≥51, verde <51 |
| `classTag(cls)` | Retorna cor do badge por classificação de risco |
| `toggle(key)` | Expande/colapsa linha para exibir insight e recomendação da IA |

### `components/SummaryCards.tsx`
| Prop | Tipo | Descrição |
|---|---|---|
| `totalSkus` | number | Total de SKUs analisados |
| `skusCriticos` | number | SKUs com score ≥ 71 |
| `perdaTotal` | number | Soma das perdas estimadas em R$ |

---

## Features por Prioridade

### Alta Prioridade — Implementadas ✅
| Feature | Onde | Descrição |
|---|---|---|
| Exportar CSV | `RiskTable.tsx → exportToCSV()` | Exporta tabela filtrada com BOM UTF-8 para Excel |
| Campo `categoria` | `data_processor.py`, `schemas.py` | Coluna opcional no upload; agrupa e filtra no frontend |
| Filtro por categoria | `RiskTable.tsx → filterCategoria` | Dropdown com todas as categorias da análise |
| Filtro por loja | `RiskTable.tsx → filterLoja` | Busca textual em tempo real |
| Promoção planejada | `data_processor.py → calcular_impacto()` | Campo `promocao_planejada` (0.0–2.0) multiplica vendas_diarias |

### Média Prioridade — Implementadas ✅
| Feature | Onde | Descrição |
|---|---|---|
| Curva ABC | `ml_engine.py → calcular_curva_abc()` | Pareto por perda: A=80%, B=95%, C=restante |
| Badge ABC visual | `RiskTable.tsx` | Badge colorido por faixa com filtro dedicado |
| Histórico de análises | `lib/history.ts`, `HistoryPanel.tsx` | 10 últimas análises em localStorage, painel dropdown |

### Gerenciamento de Categoria — Próximos Passos
| Feature | Impacto | Status |
|---|---|---|
| Benchmark de mercado | Ver posição vs média do setor | Backlog |
| Linha do tempo de análises | Evolução semana a semana | Backlog |
| Relatório PDF para apresentação | Exportação executiva | Backlog |

---

## Regras de Negócio

### Cobertura de Estoque
```
cobertura_dias = estoque_atual ÷ vendas_diarias
```
| Faixa | Status |
|---|---|
| > 14 dias | Estável |
| 7–14 dias | Atenção |
| 3–7 dias | Risco Moderado |
| < 3 dias | Risco Alto |
| 0 | Ruptura Confirmada |

### Score de Ruptura (0–100)
| Variável | Peso |
|---|---|
| Cobertura em dias | 40% |
| Tendência de vendas | 30% |
| Regularidade de abastecimento | 20% |
| Sazonalidade | 10% |

### Impacto Financeiro
```
perda_estimada = dias_de_ruptura_projetados × vendas_diarias × preco_medio
quantidade_recomendada = (vendas_diarias × 14) − estoque_atual
```

---

## Segurança

| Camada | Implementação |
|---|---|
| Autenticação | JWT via python-jose + passlib/bcrypt |
| Validação de entrada | Pydantic (automático no FastAPI) |
| Upload seguro | Whitelist .xlsx/.csv, limite 10 MB |
| Rate limiting | slowapi — 30 req/min por IP |
| CORS | Restrito ao domínio do frontend |
| SQL Injection | SQLAlchemy com parâmetros vinculados |
| Segredos | python-dotenv + .gitignore |
| HTTPS | Automático via Vercel + Render |

---

## Deploy em Produção — Guia Completo

### Passo 1 — Supabase (Banco de Dados)

1. Acesse **supabase.com** → criar conta → "New Project"
2. Escolha nome, senha forte e região (South America - São Paulo)
3. Vá em **Settings → Database → Connection string → URI**
4. Copie a URI no formato: `postgresql://postgres:[senha]@[host]:5432/postgres`
5. Guarde essa string — você vai precisar no Render

### Passo 2 — GitHub (Repositório)

```bash
cd C:/Users/Gabriel/Documents/stockops
git init
git add .
git commit -m "feat: StockOps MVP inicial"
```

Crie repositório em **github.com** e faça o push:
```bash
git remote add origin https://github.com/seu-usuario/stockops.git
git push -u origin main
```

### Passo 3 — Render (Backend)

1. Acesse **render.com** → criar conta → "New Web Service"
2. Conecte o repositório GitHub do stockops
3. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Python Version:** 3.12
4. Em **Environment Variables**, adicione:
   - `GEMINI_API_KEY` → sua chave do Google AI Studio
   - `DATABASE_URL` → string do Supabase (passo 1)
   - `JWT_SECRET_KEY` → string aleatória longa (mínimo 32 caracteres)
   - `ALLOWED_ORIGINS` → URL do Vercel (passo 4, adicione depois)
5. Deploy → copie a URL gerada (`https://stockops-backend.onrender.com`)

### Passo 4 — Vercel (Frontend)

1. Acesse **vercel.com** → criar conta → "Import Project"
2. Conecte o repositório GitHub e selecione a pasta `frontend`
3. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_API_URL` → URL do Render (passo 3)
4. Deploy → copie a URL gerada (`https://stockops.vercel.app`)
5. Volte ao Render e atualize `ALLOWED_ORIGINS` com a URL do Vercel

### Ordem de criação
```
Supabase → GitHub → Render → Vercel → Atualizar ALLOWED_ORIGINS no Render
```

### Chave Gemini (gratuita)
1. Acesse **aistudio.google.com**
2. Faça login com conta Google
3. "Get API Key" → "Create API key"
4. Copie e adicione no Render como `GEMINI_API_KEY`

---

## Como Rodar Localmente

### Backend
```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows
pip install -r requirements.txt
cp .env.example .env          # adicione sua GEMINI_API_KEY
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Acesse: `http://localhost:3000`
Credenciais de acesso: `admin / admin123`
Documentação da API: `http://localhost:8000/docs`

---

## Dados de Demonstração

Use o arquivo `demo_dados.csv` na raiz do projeto para testar o sistema.

Colunas obrigatórias: `sku`, `loja`, `estoque_atual`, `vendas_diarias`, `preco_medio`

Resultados esperados com os dados de demo:
| SKU | Loja | Situação esperada |
|---|---|---|
| Isotônico 500ml | SP-Norte | Urgente — estoque zerado |
| Água Mineral 500ml | MG-BH | Urgente — 0.1 dias de cobertura |
| Azeite Extra Virgem | SP-Leste | Ação Recomendada — 0.3 dias |
| Shampoo 400ml | SP-Sul | Ação Recomendada — 0.4 dias |
| Achocolatado 200ml | RJ-Centro | Ação Recomendada — 0.2 dias |
| Leite Integral 1L | MG-BH | Monitoramento — 2 dias de cobertura |
| Arroz Branco 5kg | SP-Sul | Estável — 3.6 dias |

---

## Deploy

| Serviço | Plataforma | Custo |
|---|---|---|
| Frontend | Vercel | Grátis |
| Backend | Render | Grátis |
| Banco de dados | Supabase | Grátis |
| IA Generativa | Gemini Flash API | Grátis (1M tokens/dia) |
| Versionamento | GitHub | Grátis |
