"""
Chat Service — Assistente Operacional com validação de domínio restrita.
Bloqueia perguntas fora do escopo antes de chamar Gemini (economia de tokens).
"""

import json
import logging
import os
import google.generativeai as genai
from services.constants import DOMAIN_NOUNS, DOMAIN_CONTEXT
from services.context_builder import build_context_for_chat

logger = logging.getLogger("stockops.chat")

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")

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
    """
    Valida se pergunta está dentro do escopo operacional.

    Retorna True se:
      - Contém pelo menos 1 substantivo do domínio (sku, loja, estoque, etc.), OU
      - Contém pelo menos 2 palavras de contexto (risco, urgente, perda, etc.)

    Args:
        question: Pergunta do usuário

    Returns:
        bool: True se dentro do escopo, False caso contrário
    """
    words = set(question.lower().split())
    has_noun = bool(words & DOMAIN_NOUNS)
    context_count = len(words & DOMAIN_CONTEXT)
    return has_noun or context_count >= 2


def responder(question: str, summary: dict) -> str:
    """
    Responde pergunta do usuário usando Gemini com validação de domínio.

    Fluxo:
      1. Valida se pergunta está no escopo
      2. Se não: retorna mensagem padrão (economia de tokens)
      3. Se sim: injeta contexto + pergunta → Gemini Flash

    Args:
        question: Pergunta do usuário
        summary: AnalysisSummary com dados da análise

    Returns:
        String com resposta formatada
    """
    if not _is_in_scope(question):
        logger.info(f"Pergunta fora do escopo bloqueada: {question[:80]}")
        return OUT_OF_SCOPE_REPLY

    context = build_context_for_chat(summary)
    prompt = (
        SYSTEM_PROMPT.format(context=context) + f"\n\nPergunta do usuário: {question}"
    )

    try:
        response = model.generate_content(prompt, timeout=15)
        result = response.text.strip()
        logger.info(f"Resposta gerada: {len(result)} chars")
        return result
    except Exception as e:
        logger.error(f"Erro ao chamar Gemini: {str(e)}")
        return (
            "Não consegui processar sua pergunta agora. Tente novamente em instantes."
        )
