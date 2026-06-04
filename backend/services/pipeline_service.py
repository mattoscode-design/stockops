"""
Pipeline central de análise de ruptura de estoque.

Recebe um DataFrame já carregado (seja via upload de planilha ou payload JSON do ERP)
e retorna um AnalysisSummary completo com score, classificação, curva ABC e relatório IA.
"""
import pandas as pd
from datetime import date
from typing import Optional

from services.data_processor import calcular_cobertura, detectar_aceleracao, calcular_impacto
from services.ml_engine import calcular_score, aplicar_classificacao, calcular_curva_abc
from services.report_service import gerar_relatorio, gerar_insight_estatico
from models.schemas import AnalysisSummary, AnalysisResponse

VALIDADE_SCORE_BOOST = 15  # boost aplicado quando validade < cobertura


def _calcular_validade_dias(data_validade_raw) -> Optional[int]:
    """Converte data_validade para dias restantes a partir de hoje. Retorna None se ausente/inválido."""
    if data_validade_raw is None or (isinstance(data_validade_raw, float) and pd.isna(data_validade_raw)):
        return None
    try:
        if isinstance(data_validade_raw, (pd.Timestamp, date)):
            dt = data_validade_raw if isinstance(data_validade_raw, date) else data_validade_raw.date()
        else:
            dt = pd.to_datetime(data_validade_raw).date()
        return (dt - date.today()).days
    except Exception:
        return None


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
    # Fallback: se nome ausente ou vazio, usa sku como nome descritivo
    if "nome" not in df.columns:
        df["nome"] = df["sku"]
    else:
        df["nome"] = df["nome"].fillna(df["sku"]).replace("", None).fillna(df["sku"])

    df = calcular_cobertura(df)
    df = detectar_aceleracao(df)
    df = calcular_impacto(df)
    df = calcular_score(df)
    df = aplicar_classificacao(df)
    df = calcular_curva_abc(df)

    resultados = []
    for row in df.to_dict("records"):
        # Validade: dias restantes, alerta e perda por vencimento
        validade_dias = _calcular_validade_dias(row.get("data_validade"))
        score = float(row["score_ruptura"])
        validade_alerta = False
        perda_validade = 0.0

        if validade_dias is not None and validade_dias > 0:
            estoque = float(row["estoque_atual"])
            vendas = float(row["vendas_diarias"])
            preco = float(row["preco_medio"])
            cobertura = estoque / vendas if vendas > 0 else 0.0
            if cobertura > validade_dias:
                validade_alerta = True
                unidades_perdidas = estoque - vendas * validade_dias
                perda_validade = round(max(0.0, unidades_perdidas) * preco, 2)
                score = min(100.0, score + VALIDADE_SCORE_BOOST)
        elif validade_dias is not None and validade_dias < row["cobertura_dias"]:
            score = min(100.0, score + VALIDADE_SCORE_BOOST)

        insight, recomendacao = gerar_insight_estatico(
            classificacao=row["classificacao"],
            cobertura=row["cobertura_dias"],
            perda=row["perda_estimada_reais"],
            quantidade=row["quantidade_recomendada"],
        )
        receita_potencial = round(float(row["estoque_atual"]) * float(row["preco_medio"]), 2)

        ean_raw = row.get("ean")
        ean = str(ean_raw) if ean_raw and not (isinstance(ean_raw, float) and pd.isna(ean_raw)) else None

        resultados.append(AnalysisResponse(
            sku=str(row["sku"]),
            nome=str(row["nome"]),
            ean=ean,
            loja=str(row["loja"]),
            categoria=str(row.get("categoria", "Sem Categoria")),
            cobertura_dias=row["cobertura_dias"],
            score_ruptura=round(score, 2),
            classificacao=row["classificacao"],
            curva_abc=str(row.get("curva_abc", "C")),
            perda_estimada_reais=row["perda_estimada_reais"],
            quantidade_recomendada=row["quantidade_recomendada"],
            receita_potencial=receita_potencial,
            validade_dias_restantes=validade_dias,
            validade_alerta=validade_alerta,
            perda_validade=perda_validade,
            insight=insight,
            recomendacao=recomendacao,
        ))

    criticos = [r for r in resultados if r.score_ruptura >= 71]
    perda_total = sum(r.perda_estimada_reais for r in resultados)
    receita_total = round(sum(r.receita_potencial for r in resultados), 2)
    categorias = sorted({r.categoria for r in resultados})
    resultados_sorted = sorted(resultados, key=lambda x: x.score_ruptura, reverse=True)

    summary_dict = {
        "total_skus": len(resultados),
        "skus_criticos": len(criticos),
        "perda_total_estimada": round(perda_total, 2),
        "receita_potencial_total": receita_total,
        "categorias": categorias,
        "resultados": [r.model_dump() for r in resultados_sorted],
    }

    return AnalysisSummary(
        total_skus=len(resultados),
        skus_criticos=len(criticos),
        perda_total_estimada=round(perda_total, 2),
        receita_potencial_total=receita_total,
        categorias=categorias,
        relatorio=gerar_relatorio(summary_dict),
        resultados=resultados_sorted,
    )
