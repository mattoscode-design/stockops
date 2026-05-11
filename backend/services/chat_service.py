import json
import logging
import os
import google.generativeai as genai

logger = logging.getLogger("stockops.chat")

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")

# Substantivos do domínio — presença de qualquer um já indica intenção válida
DOMAIN_NOUNS = {
    "sku", "loja", "estoque", "ruptura", "cobertura", "abastecimento",
    "categoria", "produto", "distribuidora", "sell-out", "sellout",
    "planilha", "giro", "reposição",
}

# Palavras de contexto — precisam de pelo menos 2 para passar sozinhas
DOMAIN_CONTEXT = {
    "venda", "vendas", "repor", "score", "risco", "perda", "região",
    "prioridade", "urgente", "alerta", "recomendação", "análise",
    "semana", "crítico", "críticos", "prioritário",
}

OUT_OF_SCOPE_REPLY = (
    "Sou o Assistente Operacional do StockOps. "
    "Só posso ajudar com análises de estoque, ruptura e abastecimento. "
    "Tente perguntar sobre SKUs, lojas, categorias ou riscos operacionais."
)

SYSTEM_PROMPT = """Você é o Assistente Operacional do StockOps — uma IA especializada \
exclusivamente em análises de ruptura de estoque, abastecimento e sell-out para distribuidoras brasileiras.

REGRAS ABSOLUTAS:
1. Responda SOMENTE sobre os dados operacionais fornecidos abaixo.
2. Se a pergunta não for sobre estoque, abastecimento, ruptura, SKUs, lojas ou vendas, \
responda EXATAMENTE: "Sou o Assistente Operacional do StockOps. Só posso ajudar com análises de estoque, ruptura e abastecimento."
3. Nunca invente dados — baseie-se apenas no contexto fornecido.
4. Comece toda resposta com "Com base na sua análise:" para deixar claro que usa os dados reais.
5. Seja direto, objetivo, linguagem de negócio em português.
6. Máximo 4 linhas.

DADOS DA ANÁLISE ATUAL:
{context}
"""


def _is_in_scope(question: str) -> bool:
    words = set(question.lower().split())
    has_noun = bool(words & DOMAIN_NOUNS)
    context_count = len(words & DOMAIN_CONTEXT)
    return has_noun or context_count >= 2


def _build_context(summary: dict) -> str:
    categorias = summary.get("categorias", [])
    lines = [
        f"Total de SKUs analisados: {summary['total_skus']}",
        f"SKUs críticos (score ≥ 71): {summary['skus_criticos']}",
        f"Perda total estimada: R$ {summary['perda_total_estimada']:,.2f}",
        f"Categorias: {', '.join(categorias) if categorias else 'Não informadas'}",
        "",
        "Top 5 SKUs por risco:",
    ]
    for r in summary["resultados"][:5]:
        cat = r.get("categoria", "-")
        lines.append(
            f"  - {r['sku']} | Cat: {cat} | Loja: {r['loja']} | "
            f"Score {r['score_ruptura']} | {r['classificacao']} | "
            f"Cobertura {r['cobertura_dias']}d | Perda R$ {r['perda_estimada_reais']:,.2f}"
        )
    if len(summary["resultados"]) > 5:
        lines.append(f"  ... e mais {len(summary['resultados']) - 5} SKUs.")
    return "\n".join(lines)


def responder(question: str, summary: dict) -> str:
    if not _is_in_scope(question):
        logger.info("Pergunta fora do escopo bloqueada: %s", question[:80])
        return OUT_OF_SCOPE_REPLY

    context = _build_context(summary)
    prompt = SYSTEM_PROMPT.format(context=context) + f"\n\nPergunta do usuário: {question}"

    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error("Erro ao chamar Gemini: %s", str(e))
        return "Não consegui processar sua pergunta agora. Tente novamente em instantes."
