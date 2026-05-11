"""
Context Builder — Consolidação de lógica de construção de contexto para Gemini.
Evita duplicação entre report_service.py e chat_service.py.
"""

from typing import Dict, Any, List


def build_context_for_report(summary: Dict[str, Any]) -> str:
    """
    Constrói contexto detalhado para relatório executivo.
    Inclui top 10 SKUs com informações completas.

    Args:
        summary: AnalysisSummary contendo resultados e métricas

    Returns:
        String formatada com contexto para Gemini gerar relatório
    """
    categorias = summary.get("categorias", [])
    urgentes = [r for r in summary["resultados"] if r["classificacao"] == "Urgente"]
    acao = [
        r for r in summary["resultados"] if r["classificacao"] == "Ação Recomendada"
    ]

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


def build_context_for_chat(summary: Dict[str, Any]) -> str:
    """
    Constrói contexto compacto para chatbot.
    Inclui top 5 SKUs com informações essenciais.

    Args:
        summary: AnalysisSummary contendo resultados e métricas

    Returns:
        String formatada com contexto para Gemini responder chatbot
    """
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


def build_context_minimal(summary: Dict[str, Any]) -> str:
    """
    Constrói contexto mínimo para operações rápidas ou debugging.

    Args:
        summary: AnalysisSummary

    Returns:
        Resumo de uma linha
    """
    return (
        f"Total: {summary['total_skus']} SKUs | "
        f"Críticos: {summary['skus_criticos']} | "
        f"Perda: R$ {summary['perda_total_estimada']:,.2f}"
    )
