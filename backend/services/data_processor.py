import pandas as pd
import numpy as np
from fastapi import HTTPException


REQUIRED_COLUMNS = {"sku", "loja", "estoque_atual", "vendas_diarias", "preco_medio"}
OPTIONAL_DEFAULTS = {
    "categoria": "Sem Categoria",
    "promocao_planejada": 0.0,
    "vendas_7d": None,
    "media_historica": None,
    "desvio_padrao": None,
    "regularidade_abastecimento": None,
    "indice_sazonalidade": None,
}


def load_file(file_bytes: bytes, filename: str) -> pd.DataFrame:
    if not filename.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Formato inválido. Use .csv ou .xlsx")
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(pd.io.common.BytesIO(file_bytes))
        else:
            df = pd.read_excel(pd.io.common.BytesIO(file_bytes))
    except Exception:
        raise HTTPException(status_code=400, detail="Erro ao ler o arquivo. Verifique o formato.")

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Colunas obrigatórias ausentes: {', '.join(sorted(missing))}"
        )

    for col, default in OPTIONAL_DEFAULTS.items():
        if col not in df.columns and default is not None:
            df[col] = default

    df["promocao_planejada"] = pd.to_numeric(df["promocao_planejada"], errors="coerce").fillna(0.0).clip(0, 2.0)

    return df


def calcular_cobertura(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["cobertura_dias"] = df["estoque_atual"] / df["vendas_diarias"].replace(0, np.nan)
    df["cobertura_dias"] = df["cobertura_dias"].fillna(0).round(1)
    return df


def detectar_aceleracao(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    cols = {"vendas_7d", "media_historica", "desvio_padrao"}
    if cols.issubset(df.columns) and df[list(cols)].notna().all().all():
        df["aceleracao"] = df["vendas_7d"] > (df["media_historica"] + 1.5 * df["desvio_padrao"])
    else:
        df["aceleracao"] = False
    return df


def calcular_impacto(df: pd.DataFrame, cobertura_alvo: int = 14) -> pd.DataFrame:
    df = df.copy()
    vendas_ajustadas = df["vendas_diarias"] * (1 + df["promocao_planejada"])
    dias_ruptura = (cobertura_alvo - df["cobertura_dias"]).clip(lower=0)
    df["perda_estimada_reais"] = (dias_ruptura * vendas_ajustadas * df["preco_medio"]).round(2)
    df["quantidade_recomendada"] = (
        (vendas_ajustadas * cobertura_alvo) - df["estoque_atual"]
    ).clip(lower=0).round(0)
    return df
