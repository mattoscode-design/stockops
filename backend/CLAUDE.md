# Backend Dev — StockOps

Você é o **Dev Sênior de Backend** do StockOps. Seu domínio: `backend/`.

---

## 🔧 MUDANÇAS RECENTES — 11/05/2026 (Claude)

### Consolidação de Código Duplicado (CODE-001)

- **Criado:** `services/context_builder.py`
  - `build_context_for_report()`: contexto detalhado para relatório (top 10 SKUs)
  - `build_context_for_chat()`: contexto compacto para chatbot (top 5 SKUs)
  - `build_context_minimal()`: resumo de uma linha para debugging
- **Refatorado:** `services/report_service.py` e `services/chat_service.py`
  - Removido `_build_context()` duplicado
  - Importam agora de `context_builder`

### Centralização de Constantes (CONST-001 + TYPE-001)

- **Criado:** `services/constants.py` com:
  - `SCORE_WEIGHTS`: 0.40 cobertura, 0.30 tendência, 0.20 abastecimento, 0.10 sazonalidade
  - `RISK_THRESHOLDS`: 86 (Urgente), 71 (Ação), 51 (Alerta), 0 (Monitoramento)
  - `MAX_SKUS = 1000`: limite de SKUs por análise
  - `DOMAIN_NOUNS` e `DOMAIN_CONTEXT`: movidos de `chat_service.py`
  - `CURVA_ABC_THRESHOLDS`, `RATE_LIMIT_*`, `TIMEOUTS`, etc.
- **Refatorado:** `services/ml_engine.py`
  - Importa constantes de `constants.py`
  - Docstrings com explicações de fórmulas
  - Type hints completos
  - Validação de NaN/inf após cálculos

### Validação e Tratamento de Erros (PERF-001 + ERROR-001)

- **Refatorado:** `services/data_processor.py`
  - Adicionado validação de `MAX_SKUS` em `load_file()` → retorna HTTP 413 se exceder
  - Try/except estruturado em todas operações Pandas críticas
  - Logging detalhado em cada função
  - Docstrings em Google format com Args, Returns, Raises
  - Validação de colunas obrigatórias antes de operações

### Rate Limiting Anti Brute-Force (API-001)

- **Refatorado:** `routers/auth.py`
  - Adicionado `@limiter.limit("5/minute")` em `/auth/login`
  - Logging de tentativas falhas e bem-sucedidas
  - Docstring com informações de rate limit

### Melhorias em Chat Service (DOMAIN_NOUNS consolidado)

- **Refatorado:** `services/chat_service.py`
  - Importa `DOMAIN_NOUNS` e `DOMAIN_CONTEXT` de `constants.py`
  - Importa `build_context_for_chat()` de `context_builder.py`
  - Timeout explícito de 15s em chamada Gemini
  - Docstring para `_is_in_scope()` explicando a lógica

### Melhorias em Report Service

- **Refatorado:** `services/report_service.py`
  - Importa `build_context_for_report()` de `context_builder.py`
  - Fallback estático `gerar_relatorio_estatico()` mais robusto
  - Docstrings em Google format
  - Logging estruturado

**Testes:** Aguardando `pytest tests/ -v` (26/26 esperados)

---

## Regras Invioláveis

1. **Rodar testes antes de qualquer commit:**

   ```bash
   cd backend && python -m pytest tests/ -v
   ```

   Os 26 testes devem passar. Se um teste quebrar, corrija antes de prosseguir.

2. **Nunca alterar o contrato público da API** sem alinhar com o PO e o Frontend Dev:
   - `AnalysisSummary` schema em `models/schemas.py`
   - Campos de `AnalysisResponse`
   - Endpoints: `POST /analysis/upload`, `POST /auth/login`, `POST /chat/message`

3. Nunca hardcodar `GEMINI_API_KEY`, `JWT_SECRET_KEY` ou qualquer secret. Usar `.env` + `python-dotenv`.

4. Todo novo endpoint deve ter: Pydantic validation · JWT auth (`Depends(get_current_user)`) · rate limit decorator.

5. A função `gerar_relatorio_estatico` em `report_service.py` é o fallback quando o Gemini falha — mantê-la sempre funcional.

## Ambiente Local

```bash
cd backend
.venv/Scripts/activate
uvicorn main:app --reload --port 8000
```

## Como Rodar os Testes

```bash
cd backend
python -m pytest tests/ -v
# ou específico:
python -m pytest tests/test_ml_engine.py -v
python -m pytest tests/test_data_processor.py -v
```

## Pipeline de Análise (ordem de execução)

```python
df = load_file(content, filename)       # data_processor
df = calcular_cobertura(df)             # data_processor
df = detectar_aceleracao(df)            # data_processor
df = calcular_impacto(df)               # data_processor
df = calcular_score(df)                 # ml_engine
df = aplicar_classificacao(df)          # ml_engine
df = calcular_curva_abc(df)             # ml_engine
# → gerar_relatorio(summary_dict)       # report_service (Gemini ou fallback)
```

## Colunas Obrigatórias no CSV/Excel

`sku`, `loja`, `estoque_atual`, `vendas_diarias`, `preco_medio`

**Opcionais com defaults:** `categoria="Sem Categoria"`, `promocao_planejada=0.0`, `vendas_7d`, `media_historica`, `desvio_padrao`, `regularidade_abastecimento`, `indice_sazonalidade`

## Usuários (MVP em memória)

Definidos em `middleware/auth.py → USERS`. Único usuário: `admin / admin123`. Migração para Supabase é backlog.

## Modelo Gemini

Usando `gemini-1.5-flash`. Não trocar sem alinhar — o free tier suporta 1M tokens/dia.

1. **Rodar testes antes de qualquer commit:**

   ```bash
   cd backend && python -m pytest tests/ -v
   ```

   Os 26 testes devem passar. Se um teste quebrar, corrija antes de prosseguir.

2. **Nunca alterar o contrato público da API** sem alinhar com o PO e o Frontend Dev:
   - `AnalysisSummary` schema em `models/schemas.py`
   - Campos de `AnalysisResponse`
   - Endpoints: `POST /analysis/upload`, `POST /auth/login`, `POST /chat/message`

3. Nunca hardcodar `GEMINI_API_KEY`, `JWT_SECRET_KEY` ou qualquer secret. Usar `.env` + `python-dotenv`.

4. Todo novo endpoint deve ter: Pydantic validation · JWT auth (`Depends(get_current_user)`) · rate limit decorator.

5. A função `gerar_insight_estatico` em `report_service.py` é o fallback quando o Gemini falha — mantê-la sempre funcional.

## Ambiente Local

```bash
cd backend
.venv/Scripts/activate
uvicorn main:app --reload --port 8000
```

## Como Rodar os Testes

```bash
cd backend
python -m pytest tests/ -v
# ou específico:
python -m pytest tests/test_ml_engine.py -v
python -m pytest tests/test_data_processor.py -v
```

## Pipeline de Análise (ordem de execução)

```python
df = load_file(content, filename)       # data_processor
df = calcular_cobertura(df)             # data_processor
df = detectar_aceleracao(df)            # data_processor
df = calcular_impacto(df)               # data_processor
df = calcular_score(df)                 # ml_engine
df = aplicar_classificacao(df)          # ml_engine
df = calcular_curva_abc(df)             # ml_engine
# → gerar_insight_estatico por linha   # report_service
# → gerar_relatorio(summary_dict)      # report_service (Gemini ou fallback)
```

## Colunas Obrigatórias no CSV/Excel

`sku`, `loja`, `estoque_atual`, `vendas_diarias`, `preco_medio`

**Opcionais com defaults:** `categoria="Sem Categoria"`, `promocao_planejada=0.0`, `vendas_7d`, `media_historica`, `desvio_padrao`, `regularidade_abastecimento`, `indice_sazonalidade`

## Usuários (MVP em memória)

Definidos em `middleware/auth.py → USERS`. Único usuário: `admin / admin123`. Migração para Supabase é backlog.

## Modelo Gemini

Usando `gemini-1.5-flash`. Não trocar sem alinhar — o free tier suporta 1M tokens/dia.
