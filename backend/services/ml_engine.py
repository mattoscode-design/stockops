"""
ML Engine — Pipeline de cálculo de score de ruptura, classificação de risco e curva ABC.
Todos os pesos e limiares vêm de services/constants.py para facilitar manutenção.
"""

import logging
import pandas as pd
import numpy as np
from services.constants import (
    SCORE_WEIGHTS,
    RISK_THRESHOLDS,
    DEFAULT_REGULARIDADE_ABASTECIMENTO,
    DEFAULT_INDICE_SAZONALIDADE,
    MAX_COBERTURA_DIAS,
    CURVA_ABC_THRESHOLDS,
)

logger = logging.getLogger("stockops.ml_engine")


def calcular_score(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calcula score de ruptura (0-100) usando pesos configuráveis.

    Fórmula:
      score = (cobertura_norm * 0.40) + (tendencia_norm * 0.30)
            + (abastecimento_norm * 0.20) + (sazonalidade_norm * 0.10)

    Args:
        df: DataFrame com colunas: cobertura_dias, aceleracao,
            regularidade_abastecimento (opt), indice_sazonalidade (opt)

    Returns:
        DataFrame com nova coluna 'score_ruptura' (0-100)

    Raises:
        ValueError: Se colunas obrigatórias faltarem ou contiverem NaN/inf
    """
    df = df.copy()

    # Validação de colunas obrigatórias
    required = ["cobertura_dias", "aceleracao"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Colunas obrigatórias faltando: {missing}")

    try:
        # Componentes normalizados (0-1)
        cobertura_norm = 1 - (
            df["cobertura_dias"].clip(0, MAX_COBERTURA_DIAS) / MAX_COBERTURA_DIAS
        )
        tendencia_norm = df["aceleracao"].astype(float)

        # Regularidade de abastecimento (padrão 0.3 se não informado)
        if (
            "regularidade_abastecimento" in df.columns
            and df["regularidade_abastecimento"].notna().any()
        ):
            abastecimento_norm = 1 - df["regularidade_abastecimento"].clip(0, 1)
        else:
            abastecimento_norm = pd.Series(
                DEFAULT_REGULARIDADE_ABASTECIMENTO, index=df.index
            )

        # Sazonalidade (padrão 0.1 se não informado)
        if (
            "indice_sazonalidade" in df.columns
            and df["indice_sazonalidade"].notna().any()
        ):
            sazonalidade_norm = df["indice_sazonalidade"].clip(0, 1)
        else:
            sazonalidade_norm = pd.Series(DEFAULT_INDICE_SAZONALIDADE, index=df.index)

        # Validação de NaN/inf após normalização
        for col_name, col_data in {
            "cobertura_norm": cobertura_norm,
            "tendencia_norm": tendencia_norm,
            "abastecimento_norm": abastecimento_norm,
            "sazonalidade_norm": sazonalidade_norm,
        }.items():
            if col_data.isna().any():
                logger.warning(f"NaN detectado em {col_name}. Preenchendo com 0.")
                col_data = col_data.fillna(0)
            if np.isinf(col_data).any():
                logger.warning(f"Inf detectado em {col_name}. Clipping para [0, 1].")
                col_data = col_data.clip(0, 1)

        # Cálculo do score ponderado
        df["score_ruptura"] = (
            cobertura_norm * SCORE_WEIGHTS["cobertura"]
            + tendencia_norm * SCORE_WEIGHTS["tendencia"]
            + abastecimento_norm * SCORE_WEIGHTS["abastecimento"]
            + sazonalidade_norm * SCORE_WEIGHTS["sazonalidade"]
        ) * 100

        # Normalizar para 0-100 e arredondar
        df["score_ruptura"] = df["score_ruptura"].round(1).clip(0, 100)

        # Validação final
        if df["score_ruptura"].isna().any():
            raise ValueError("Score contém NaN após cálculo")

        return df

    except Exception as e:
        logger.error(f"Erro ao calcular score: {str(e)}")
        raise


def classificar_risco(score: float) -> str:
    """
    Classifica risco baseado em score (0-100).

    Limiares (em ordem de urgência):
      - score >= 86: Urgente
      - score >= 71: Ação Recomendada
      - score >= 51: Alerta
      - score < 51: Monitoramento

    Args:
        score: Score de ruptura (0-100)

    Returns:
        String com classificação: "Urgente", "Ação Recomendada", "Alerta" ou "Monitoramento"
    """
    for classificacao in ["Urgente", "Ação Recomendada", "Alerta"]:
        if score >= RISK_THRESHOLDS[classificacao]:
            return classificacao
    return "Monitoramento"


def aplicar_classificacao(df: pd.DataFrame) -> pd.DataFrame:
    """
    Aplica função classificar_risco() a cada linha.

    Args:
        df: DataFrame com coluna 'score_ruptura'

    Returns:
        DataFrame com nova coluna 'classificacao'
    """
    df = df.copy()
    if "score_ruptura" not in df.columns:
        raise ValueError("Coluna 'score_ruptura' não encontrada")

    df["classificacao"] = df["score_ruptura"].apply(classificar_risco)
    return df


def calcular_curva_abc(df: pd.DataFrame) -> pd.DataFrame:
    """
    Classifica SKUs em A, B ou C pelo princípio de Pareto (80/20) aplicado à perda estimada.

    Classificação:
      - A: SKUs que acumulam até 80% da perda total
      - B: SKUs que acumulam de 80% a 95% da perda total
      - C: Restante (95%-100%)

    Args:
        df: DataFrame com coluna 'perda_estimada_reais'

    Returns:
        DataFrame com nova coluna 'curva_abc' (A, B ou C)
    """
    df = df.copy()

    if "perda_estimada_reais" not in df.columns:
        raise ValueError("Coluna 'perda_estimada_reais' não encontrada")

    total = df["perda_estimada_reais"].sum()

    # Se zero perda, todos são C
    if total == 0:
        df["curva_abc"] = "C"
        logger.info("Perda total é zero. Todos os SKUs classificados como C.")
        return df

    # Ordenar por perda decrescente e calcular percentual acumulado
    sorted_series = df["perda_estimada_reais"].sort_values(ascending=False)
    cumulative_pct = sorted_series.cumsum() / total

    # Aplicar lógica de Pareto
    abc_series = cumulative_pct.apply(
        lambda x: (
            "A"
            if x <= CURVA_ABC_THRESHOLDS["A"]
            else ("B" if x <= CURVA_ABC_THRESHOLDS["B"] else "C")
        )
    )

    df["curva_abc"] = abc_series
    return df
