from dotenv import load_dotenv
load_dotenv()  # Deve rodar antes de qualquer import que leia variáveis de ambiente

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
import os

from middleware.rate_limit import limiter
from routers import auth, analysis, chat, api_v1, inventory, analyses

_CYAN  = "\033[96m"
_AMBER = "\033[93m"
_GREEN = "\033[92m"
_DIM   = "\033[2m"
_RESET = "\033[0m"

def _print_docs():
    print(f"\n{_AMBER}{'═' * 60}{_RESET}")
    print(f"{_AMBER}  STOCKOPS API — v1.0.0{_RESET}")
    print(f"{_AMBER}{'═' * 60}{_RESET}\n")

    print(f"{_CYAN}  ROTAS DISPONÍVEIS{_RESET}")
    routes = [
        ("POST", "/auth/login",       "login(data)",                "Autentica usuário e retorna JWT"),
        ("GET",  "/health",           "health()",                   "Verifica status do servidor"),
        ("POST", "/analysis/upload",  "upload_and_analyze(file)",   "Pipeline completo: upload → score → IA"),
    ]
    for method, path, fn, desc in routes:
        m = _GREEN if method == "GET" else _AMBER
        print(f"  {m}{method:<6}{_RESET} {path:<26} {_DIM}{fn:<30}{_RESET} {desc}")

    print(f"\n{_CYAN}  FUNÇÕES — services/data_processor.py{_RESET}")
    fns = [
        ("load_file(bytes, filename)",          "Lê Excel/CSV e valida colunas obrigatórias"),
        ("calcular_cobertura(df)",              "cobertura_dias = estoque_atual / vendas_diarias"),
        ("detectar_aceleracao(df)",             "Detecta giro > média + 1.5 desvio padrão"),
        ("calcular_impacto(df)",                "Calcula perda_estimada_reais e quantidade_recomendada"),
    ]
    for fn, desc in fns:
        print(f"  {_DIM}→{_RESET} {fn:<42} {_DIM}{desc}{_RESET}")

    print(f"\n{_CYAN}  FUNÇÕES — services/ml_engine.py{_RESET}")
    fns = [
        ("calcular_score(df)",                  "Score 0-100: 40% cobertura + 30% tendência + ..."),
        ("classificar_risco(score)",             "86→Urgente 71→Ação 51→Alerta 0→Monitoramento"),
        ("aplicar_classificacao(df)",            "Aplica classificar_risco em todo o DataFrame"),
    ]
    for fn, desc in fns:
        print(f"  {_DIM}→{_RESET} {fn:<42} {_DIM}{desc}{_RESET}")

    print(f"\n{_CYAN}  FUNÇÕES — services/ai_insights.py{_RESET}")
    print(f"  {_DIM}→{_RESET} {'gerar_insight(sku, loja, score, ...)':<42} {_DIM}Chama Gemini Flash → (insight, recomendacao){_RESET}")

    print(f"\n{_CYAN}  FUNÇÕES — middleware/auth.py{_RESET}")
    fns = [
        ("verify_password(plain, hashed)",      "Verifica senha via bcrypt"),
        ("create_token(data)",                  "Gera JWT com expiração configurável"),
        ("get_current_user(token)",             "Decodifica JWT e retorna usuário autenticado"),
    ]
    for fn, desc in fns:
        print(f"  {_DIM}→{_RESET} {fn:<42} {_DIM}{desc}{_RESET}")

    print(f"\n{_CYAN}  SEGURANÇA ATIVA{_RESET}")
    sec = ["JWT Auth", "Pydantic Validation", "Rate Limit 30/min", "CORS", "bcrypt", "SQLAlchemy ORM"]
    print(f"  {_DIM}" + "  ·  ".join(sec) + f"{_RESET}")

    print(f"\n{_GREEN}  Docs interativos → http://localhost:8000/docs{_RESET}")
    print(f"{_AMBER}{'═' * 60}{_RESET}\n")

_print_docs()

app = FastAPI(title="StockOps API", version="1.0.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(analysis.router)
app.include_router(chat.router)
app.include_router(api_v1.router)
app.include_router(inventory.router)
app.include_router(analyses.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "StockOps API"}
