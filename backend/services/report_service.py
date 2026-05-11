import logging
import os
import google.generativeai as genai

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


def _build_context(summary: dict) -> str:
    categorias = summary.get("categorias", [])
    urgentes = [r for r in summary["resultados"] if r["classificacao"] == "Urgente"]
    acao = [r for r in summary["resultados"] if r["classificacao"] == "Ação Recomendada"]

    lines = [
        f"Total de SKUs: {summary['total_skus']}",
        f"SKUs críticos (score ≥ 71): {summary['skus_criticos']}",
        f"Perda total estimada: R$ {summary['perda_total_estimada']:,.2f}",
        f"Categorias: {', '.join(categorias) if categorias else 'Não informadas'}",
        f"Urgentes: {len(urgentes)} · Ação Recomendada: {len(acao)}",
        "",
        "Top 10 SKUs por risco:",
    ]

    for r in summary["resultados"][:10]:
        lines.append(
            f"  - {r['sku']} | {r.get('categoria', '-')} | {r['loja']} | "
            f"Score {r['score_ruptura']} | {r['classificacao']} | "
            f"Cobertura {r['cobertura_dias']}d | Perda R$ {r['perda_estimada_reais']:,.2f} | "
            f"ABC: {r.get('curva_abc', '-')}"
        )

    if len(summary["resultados"]) > 10:
        lines.append(f"  ... e mais {len(summary['resultados']) - 10} SKUs.")

    return "\n".join(lines)


def gerar_relatorio(summary: dict) -> str:
    context = _build_context(summary)
    prompt = REPORT_PROMPT.format(context=context)

    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error("Erro ao gerar relatório: %s", str(e))
        skus_criticos = summary.get("skus_criticos", 0)
        perda = summary.get("perda_total_estimada", 0)
        return (
            f"## Situação Geral\n"
            f"Análise concluída: {summary.get('total_skus', 0)} SKUs processados. "
            f"{skus_criticos} em estado crítico com perda estimada de R$ {perda:,.2f}.\n\n"
            f"## Recomendações Prioritárias\n"
            f"Revise os SKUs marcados como Urgente e Ação Recomendada na aba Ranking.\n\n"
            f"## Próximos 7 Dias\n"
            f"Priorize a reposição dos SKUs com menor cobertura e maior perda estimada."
        )


def gerar_insight_estatico(
    classificacao: str, cobertura: float, perda: float, quantidade: float
) -> tuple[str, str]:
    if classificacao == "Urgente":
        insight = f"Risco crítico: {cobertura}d de cobertura. Perda estimada R$ {perda:,.2f}."
    elif classificacao == "Ação Recomendada":
        insight = f"Ação necessária: {cobertura}d de cobertura. Janela de reposição se fechando."
    elif classificacao == "Alerta":
        insight = f"Monitorar: {cobertura}d de cobertura. Acompanhar evolução do giro."
    else:
        insight = f"Estável: {cobertura}d de cobertura dentro do esperado."

    recomendacao = (
        f"Repor {quantidade:.0f} unidades para garantir 14 dias de cobertura."
        if quantidade > 0 else "Cobertura adequada — sem reposição necessária."
    )
    return insight, recomendacao
