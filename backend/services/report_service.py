"""
Report Service — Geração de relatórios executivos via Gemini Flash com fallback estático.
"""

import logging
import os
import google.generativeai as genai
from services.context_builder import build_context_for_report

logger = logging.getLogger("stockops.report")

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash")

REPORT_PROMPT = """Você é um analista operacional sênior de varejo brasileiro. \
Gere um relatório executivo em português sobre a análise de estoque abaixo.

Use EXATAMENTE esta estrutura (markdown simples, sem ```):

## Situação Geral
[2-3 frases diretas sobre o estado operacional. Cite números reais da análise.]

## Principais Riscos
[Top 3 SKUs mais críticos com produto, loja, cobertura e perda estimada.]

## Recomendações Prioritárias
[3 ações concretas ordenadas por urgência. Seja específico.]

## Análise por Categoria
[Uma frase por categoria com status e risco principal. Omitir se não houver categorias definidas.]

## Próximos 7 Dias
[2 ações imediatas com prazo claro.]

DADOS DA ANÁLISE:
{context}
"""


def gerar_relatorio(summary: dict) -> str:
    """
    Gera relatório executivo usando Gemini Flash com fallback estático.

    Args:
        summary: AnalysisSummary contendo resultados e métricas

    Returns:
        String com relatório em markdown formatado
    """
    context = build_context_for_report(summary)
    prompt = REPORT_PROMPT.format(context=context)

    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error(f"Erro ao gerar relatório via Gemini: {str(e)}")
        return gerar_relatorio_estatico(summary)


def gerar_relatorio_estatico(summary: dict) -> str:
    """
    Fallback estático quando Gemini falha.
    Gera relatório estruturado sem chamada a API.

    Args:
        summary: AnalysisSummary

    Returns:
        String com relatório formatado em markdown
    """
    skus_criticos = summary.get("skus_criticos", 0)
    total_skus = summary.get("total_skus", 0)
    perda = summary.get("perda_total_estimada", 0)
    categorias = summary.get("categorias", [])

    # Contar por classificação
    urgentes = len(
        [r for r in summary.get("resultados", []) if r["classificacao"] == "Urgente"]
    )
    acao = len(
        [
            r
            for r in summary.get("resultados", [])
            if r["classificacao"] == "Ação Recomendada"
        ]
    )
    alerta = len(
        [r for r in summary.get("resultados", []) if r["classificacao"] == "Alerta"]
    )

    lines = [
        "## Situação Geral",
        f"Análise concluída: {total_skus} SKUs processados.",
        f"{skus_criticos} SKUs em estado crítico (score ≥ 71) com perda estimada de R$ {perda:,.2f}.",
        f"Distribuição: {urgentes} Urgentes · {acao} Ação Recomendada · {alerta} Alertas.",
        "",
        "## Principais Riscos",
        "Revise os SKUs marcados como Urgente e Ação Recomendada na aba Ranking para detalhes completos.",
        "",
        "## Recomendações Prioritárias",
        "1. Priorize reposição dos SKUs Urgentes imediatamente.",
        "2. Monitorar SKUs em estado Ação Recomendada diariamente.",
        "3. Revisar frequência de abastecimento das categorias mais críticas.",
        "",
        "## Análise por Categoria",
    ]

    if categorias:
        for cat in categorias:
            cat_skus = [
                r for r in summary.get("resultados", []) if r.get("categoria") == cat
            ]
            if cat_skus:
                cat_urgentes = len(
                    [r for r in cat_skus if r["classificacao"] == "Urgente"]
                )
                cat_avg_score = sum(r["score_ruptura"] for r in cat_skus) / len(
                    cat_skus
                )
                lines.append(
                    f"- **{cat}**: {len(cat_skus)} SKUs, {cat_urgentes} Urgentes, Score médio {cat_avg_score:.1f}"
                )
    else:
        lines.append("Sem dados de categorias disponíveis.")

    lines.extend(
        [
            "",
            "## Próximos 7 Dias",
            "- Executar reposição conforme quantidade recomendada na planilha.",
            "- Rastrear cobertura diária dos SKUs críticos.",
        ]
    )

    return "\n".join(lines)


def gerar_insight_estatico(
    classificacao: str, cobertura: float, perda: float, quantidade: float
) -> tuple[str, str]:
    if classificacao == "Urgente":
        insight = (
            f"Risco crítico: {cobertura}d de cobertura. Perda estimada R$ {perda:,.2f}."
        )
    elif classificacao == "Ação Recomendada":
        insight = f"Ação necessária: {cobertura}d de cobertura. Janela de reposição se fechando."
    elif classificacao == "Alerta":
        insight = f"Monitorar: {cobertura}d de cobertura. Acompanhar evolução do giro."
    else:
        insight = f"Estável: {cobertura}d de cobertura dentro do esperado."

    recomendacao = (
        f"Repor {quantidade:.0f} unidades para garantir 14 dias de cobertura."
        if quantidade > 0
        else "Cobertura adequada — sem reposição necessária."
    )
    return insight, recomendacao
