"""
Constantes globais do StockOps para cálculos ML e operações.
Centralizar aqui todas as constantes mágicas para fácil manutenção.
"""

# ============================================================================
# LIMITES E VALIDAÇÕES
# ============================================================================
MAX_SKUS = 1000  # Limite máximo de SKUs por análise
MAX_FILE_SIZE_MB = 50  # Limite de tamanho de arquivo em MB
CHUNK_SIZE_SKUS = 100  # Tamanho de chunk para processamento em lotes

# ============================================================================
# SCORE DE RUPTURA — PESOS E CLASSIFICAÇÕES
# ============================================================================

# Pesos para cálculo do score (devem somar 1.0)
SCORE_WEIGHTS = {
    "cobertura": 0.40,  # Peso para dias de cobertura
    "tendencia": 0.30,  # Peso para aceleração de vendas
    "abastecimento": 0.20,  # Peso para regularidade de abastecimento
    "sazonalidade": 0.10,  # Peso para índice de sazonalidade
}

# Limites de score para classificação (devem estar em ordem decrescente)
RISK_THRESHOLDS = {
    "Urgente": 86,  # score >= 86
    "Ação Recomendada": 71,  # score >= 71
    "Alerta": 51,  # score >= 51
    "Monitoramento": 0,  # score < 51
}

# Valores padrão quando dados não estão disponíveis
DEFAULT_REGULARIDADE_ABASTECIMENTO = 0.3  # 30% de regularidade por padrão
DEFAULT_INDICE_SAZONALIDADE = 0.1  # 10% de sazonalidade por padrão

# ============================================================================
# COBERTURA E REPOSIÇÃO
# ============================================================================
COBERTURA_ALVO_DIAS = 14  # Dias de cobertura alvo para reposição sugerida
MAX_COBERTURA_DIAS = 14  # Limite máximo para normalização de cobertura
LIMITE_ACELERACAO = 1.5  # Multiplicador sigma para detectar aceleração

# ============================================================================
# CURVA ABC — PARETO
# ============================================================================
CURVA_ABC_THRESHOLDS = {
    "A": 0.80,  # SKUs até 80% da perda acumulada
    "B": 0.95,  # SKUs até 95% da perda acumulada
    "C": 1.00,  # Restante
}

# ============================================================================
# CHATBOT E VALIDAÇÃO DE DOMÍNIO
# ============================================================================
DOMAIN_NOUNS = {
    "sku",
    "loja",
    "estoque",
    "ruptura",
    "cobertura",
    "abastecimento",
    "categoria",
    "produto",
    "distribuidora",
    "sell-out",
    "sellout",
    "planilha",
    "giro",
    "reposição",
}

DOMAIN_CONTEXT = {
    "venda",
    "vendas",
    "repor",
    "score",
    "risco",
    "perda",
    "região",
    "prioridade",
    "urgente",
    "alerta",
    "recomendação",
    "análise",
    "semana",
    "crítico",
    "críticos",
    "prioritário",
}

# ============================================================================
# PROCESSAMENTO DE DADOS
# ============================================================================
REQUIRED_COLUMNS = {
    "sku",
    "loja",
    "estoque_atual",
    "vendas_diarias",
    "preco_medio",  # Obrigatório para cálculo de perda
}

OPTIONAL_COLUMNS = {
    "nome",
    "categoria",
    "data_validade",
    "regularidade_abastecimento",
    "indice_sazonalidade",
    "aceleracao",
}

# ============================================================================
# RATE LIMITING
# ============================================================================
RATE_LIMIT_GLOBAL = "30/minute"  # Limite global por IP
RATE_LIMIT_LOGIN = "5/minute"  # Limite específico para login (anti brute-force)
RATE_LIMIT_UPLOAD = "10/minute"  # Limite para uploads de análise

# ============================================================================
# TIMEOUTS
# ============================================================================
GEMINI_TIMEOUT_SECONDS = 15  # Timeout para chamadas ao Gemini
FILE_PROCESSING_TIMEOUT_SECONDS = 60  # Timeout para processamento de arquivo

# ============================================================================
# CACHE E PERFORMANCE
# ============================================================================
CACHE_MAX_ITEMS = 100  # Máximo de análises em cache
CACHE_TTL_SECONDS = 3600  # TTL de cache em segundos (1 hora)
