import pandas as pd


COBERTURA_PESO     = 0.40
TENDENCIA_PESO     = 0.30
ABASTECIMENTO_PESO = 0.20
SAZONALIDADE_PESO  = 0.10


def calcular_score(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    cobertura_norm = 1 - (df["cobertura_dias"].clip(0, 14) / 14)
    tendencia_norm = df["aceleracao"].astype(float)

    if "regularidade_abastecimento" in df.columns and df["regularidade_abastecimento"].notna().all():
        abastecimento_norm = 1 - df["regularidade_abastecimento"].clip(0, 1)
    else:
        abastecimento_norm = pd.Series(0.3, index=df.index)

    if "indice_sazonalidade" in df.columns and df["indice_sazonalidade"].notna().all():
        sazonalidade_norm = df["indice_sazonalidade"].clip(0, 1)
    else:
        sazonalidade_norm = pd.Series(0.1, index=df.index)

    df["score_ruptura"] = (
        cobertura_norm     * COBERTURA_PESO
        + tendencia_norm   * TENDENCIA_PESO
        + abastecimento_norm * ABASTECIMENTO_PESO
        + sazonalidade_norm  * SAZONALIDADE_PESO
    ) * 100

    df["score_ruptura"] = df["score_ruptura"].round(1).clip(0, 100)
    return df


def classificar_risco(score: float) -> str:
    if score >= 86:   return "Urgente"
    if score >= 71:   return "Ação Recomendada"
    if score >= 51:   return "Alerta"
    return "Monitoramento"


def aplicar_classificacao(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["classificacao"] = df["score_ruptura"].apply(classificar_risco)
    return df


def calcular_curva_abc(df: pd.DataFrame) -> pd.DataFrame:
    """
    Classifica SKUs em A, B ou C pelo princípio de Pareto aplicado à perda estimada:
      A = SKUs que representam até 80% da perda total acumulada
      B = SKUs que representam de 80% a 95%
      C = SKUs restantes
    """
    df = df.copy()
    total = df["perda_estimada_reais"].sum()

    if total == 0:
        df["curva_abc"] = "C"
        return df

    sorted_series = df["perda_estimada_reais"].sort_values(ascending=False)
    cumulative_pct = sorted_series.cumsum() / total

    abc_series = cumulative_pct.apply(
        lambda x: "A" if x <= 0.80 else ("B" if x <= 0.95 else "C")
    )

    df["curva_abc"] = abc_series
    return df
