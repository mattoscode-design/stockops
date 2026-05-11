"""
Pipeline central de análise de ruptura de estoque.

Recebe um DataFrame já carregado (seja via upload de planilha ou payload JSON do ERP)
e retorna um AnalysisSummary completo com score, classificação, curva ABC e relatório IA.
"""
import pandas as pd

from services.data_processor import calcular_cobertura, detectar_aceleracao, calcular_impacto
from services.ml_engine import calcular_score, aplicar_classificacao, calcular_curva_abc
from services.report_service import gerar_relatorio, gerar_insight_estatico
from models.schemas import AnalysisSummary, AnalysisResponse


def run_analysis_pipeline(df: pd.DataFrame) -> AnalysisSummary:
    """
    Executa o pipeline completo de análise a partir de um DataFrame bruto.

    Ordem de execução:
        calcular_cobertura → detectar_aceleracao → calcular_impacto
        → calcular_score → aplicar_classificacao → calcular_curva_abc
        → gerar_insight_estatico (por SKU) → gerar_relatorio (Gemini / fallback)

    Args:
        df: DataFrame com as colunas obrigatórias (sku, loja, estoque_atual,
            vendas_diarias, preco_medio) e opcionais com defaults.

    Returns:
        AnalysisSummary com todos os SKUs ranqueados por score_ruptura.
    """
    df = calcular_cobertura(df)
    df = detectar_aceleracao(df)
    df = calcular_impacto(df)
    df = calcular_score(df)
    df = aplicar_classificacao(df)
    df = calcular_curva_abc(df)

    resultados = []
    for row in df.to_dict("records"):
        insight, recomendacao = gerar_insight_estatico(
            classificacao=row["classificacao"],
            cobertura=row["cobertura_dias"],
            perda=row["perda_estimada_reais"],
            quantidade=row["quantidade_recomendada"],
        )
        resultados.append(AnalysisResponse(
            sku=str(row["sku"]),
            loja=str(row["loja"]),
            categoria=str(row.get("categoria", "Sem Categoria")),
            cobertura_dias=row["cobertura_dias"],
            score_ruptura=row["score_ruptura"],
            classificacao=row["classificacao"],
            curva_abc=str(row.get("curva_abc", "C")),
            perda_estimada_reais=row["perda_estimada_reais"],
            quantidade_recomendada=row["quantidade_recomendada"],
            insight=insight,
            recomendacao=recomendacao,
        ))

    criticos = [r for r in resultados if r.score_ruptura >= 71]
    perda_total = sum(r.perda_estimada_reais for r in resultados)
    categorias = sorted({r.categoria for r in resultados})
    resultados_sorted = sorted(resultados, key=lambda x: x.score_ruptura, reverse=True)

    summary_dict = {
        "total_skus": len(resultados),
        "skus_criticos": len(criticos),
        "perda_total_estimada": round(perda_total, 2),
        "categorias": categorias,
        "resultados": [r.model_dump() for r in resultados_sorted],
    }

    return AnalysisSummary(
        total_skus=len(resultados),
        skus_criticos=len(criticos),
        perda_total_estimada=round(perda_total, 2),
        categorias=categorias,
        relatorio=gerar_relatorio(summary_dict),
        resultados=resultados_sorted,
    )
