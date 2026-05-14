"""
Data Processor — Pipeline de leitura, validação e preparação de dados para análise ML.
Consolida lógica de carregamento de CSV/Excel, normalização e cálculos operacionais.
"""

import logging
from io import BytesIO
import pandas as pd
import numpy as np
from fastapi import HTTPException
from services.constants import (
    REQUIRED_COLUMNS,
    OPTIONAL_COLUMNS,
    MAX_SKUS,
    COBERTURA_ALVO_DIAS,
    LIMITE_ACELERACAO,
)

logger = logging.getLogger("stockops.data_processor")

OPTIONAL_DEFAULTS = {col: None for col in OPTIONAL_COLUMNS}
# Override específicos
OPTIONAL_DEFAULTS["categoria"] = "Sem Categoria"
OPTIONAL_DEFAULTS["promocao_planejada"] = 0.0


def load_file(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """
    Carrega arquivo CSV ou Excel e normaliza colunas.

    Validações:
      - Formato: .csv ou .xlsx
      - Colunas obrigatórias presentes
      - Limite de SKUs: MAX_SKUS (padrão 1000)

    Args:
        file_bytes: Conteúdo do arquivo em bytes
        filename: Nome do arquivo (usado para detectar formato)

    Returns:
        DataFrame normalizado com colunas em snake_case

    Raises:
        HTTPException 400: Se formato inválido
        HTTPException 400: Se arquivo corrompido
        HTTPException 422: Se colunas obrigatórias faltam
        HTTPException 413: Se exceder MAX_SKUS
    """
    # Validar formato
    if not filename.lower().endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(
            status_code=400, detail="Formato inválido. Use .csv ou .xlsx"
        )

    # Ler arquivo
    try:
        if filename.lower().endswith(".csv"):
            df = pd.read_csv(BytesIO(file_bytes))
        else:
            df = pd.read_excel(BytesIO(file_bytes))
        logger.info(f"Arquivo {filename} carregado: {len(df)} linhas")
    except Exception as e:
        logger.error(f"Erro ao ler arquivo: {str(e)}")
        raise HTTPException(
            status_code=400, detail="Erro ao ler o arquivo. Verifique o formato."
        )

    # Normalizar nomes de colunas
    df.columns = [
        c.strip().lower().replace(" ", "_").replace("-", "_") for c in df.columns
    ]

    # Validar colunas obrigatórias
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Colunas obrigatórias ausentes: {', '.join(sorted(missing))}",
        )

    # Validar limite de SKUs (PERF-001)
    if len(df) > MAX_SKUS:
        raise HTTPException(
            status_code=413,
            detail=f"Arquivo excede limite de {MAX_SKUS} SKUs. Você enviou {len(df)}.",
        )

    # Preencher colunas opcionais com padrões
    for col, default in OPTIONAL_DEFAULTS.items():
        if col not in df.columns:
            if default is None:
                df[col] = np.nan
            else:
                df[col] = default

    # Normalizar promoção planejada
    try:
        df["promocao_planejada"] = (
            pd.to_numeric(df["promocao_planejada"], errors="coerce")
            .fillna(0.0)
            .clip(0, 2.0)
        )
    except Exception as e:
        logger.warning(f"Erro ao normalizar promocao_planejada: {str(e)}")
        df["promocao_planejada"] = 0.0

    logger.info(f"Arquivo {filename} validado: {len(df)} SKUs")
    return df


def calcular_cobertura(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calcula dias de cobertura: estoque_atual / vendas_diarias.

    Lógica:
      - Se vendas_diarias = 0: cobertura = 0 (risco máximo)
      - Arredonda para 1 casa decimal

    Args:
        df: DataFrame com colunas 'estoque_atual' e 'vendas_diarias'

    Returns:
        DataFrame com nova coluna 'cobertura_dias'
    """
    df = df.copy()

    if "estoque_atual" not in df.columns or "vendas_diarias" not in df.columns:
        raise ValueError("Colunas 'estoque_atual' e 'vendas_diarias' são obrigatórias")

    try:
        df["cobertura_dias"] = df["estoque_atual"] / df["vendas_diarias"].replace(
            0, np.nan
        )
        df["cobertura_dias"] = df["cobertura_dias"].fillna(0).round(1)
        logger.info(
            f"Cobertura calculada: media={df['cobertura_dias'].mean():.1f}, max={df['cobertura_dias'].max():.1f}"
        )
    except Exception as e:
        logger.error(f"Erro ao calcular cobertura: {str(e)}")
        raise

    return df


def detectar_aceleracao(df: pd.DataFrame) -> pd.DataFrame:
    """
    Detecta aceleração de vendas: vendas_7d > (media_historica + 1.5σ).

    Condições:
      - Se colunas vendas_7d, media_historica, desvio_padrao existem e sem NaN: usa fórmula
      - Caso contrário: todas as linhas = False

    Args:
        df: DataFrame com colunas opcionais 'vendas_7d', 'media_historica', 'desvio_padrao'

    Returns:
        DataFrame com nova coluna 'aceleracao' (bool)
    """
    df = df.copy()

    cols_necessarias = {"vendas_7d", "media_historica", "desvio_padrao"}

    if cols_necessarias.issubset(df.columns):
        try:
            # Validar sem NaN
            if df[list(cols_necessarias)].notna().all().all():
                aceleracao = df["vendas_7d"] > (
                    df["media_historica"] + LIMITE_ACELERACAO * df["desvio_padrao"]
                )
                df["aceleracao"] = aceleracao.astype(float)
                aceleracao_count = aceleracao.sum()
                logger.info(f"Aceleração detectada em {aceleracao_count} SKUs")
            else:
                logger.warning(
                    "NaN detectado em colunas de aceleração. Usando padrão=False"
                )
                df["aceleracao"] = 0.0
        except Exception as e:
            logger.error(f"Erro ao detectar aceleração: {str(e)}")
            df["aceleracao"] = 0.0
    else:
        df["aceleracao"] = 0.0

    return df


def calcular_impacto(
    df: pd.DataFrame, cobertura_alvo: int = COBERTURA_ALVO_DIAS
) -> pd.DataFrame:
    """
    Calcula impacto financeiro da ruptura e quantidade recomendada para reposição.

    Fórmulas:
      - dias_ruptura = max(0, cobertura_alvo - cobertura_dias)
      - perda_estimada = dias_ruptura × (vendas_diarias × promo) × preco_medio
      - quantidade_recomendada = max(0, (vendas_diarias × promo × cobertura_alvo) - estoque_atual)

    Args:
        df: DataFrame com colunas: vendas_diarias, cobertura_dias, preco_medio, promo, estoque_atual
        cobertura_alvo: Dias de cobertura desejados (padrão 14)

    Returns:
        DataFrame com novas colunas 'perda_estimada_reais' e 'quantidade_recomendada'
    """
    df = df.copy()

    obrigatorias = {"estoque_atual", "vendas_diarias", "preco_medio", "cobertura_dias"}
    missing = obrigatorias - set(df.columns)
    if missing:
        raise ValueError(f"Colunas obrigatórias faltando: {missing}")

    try:
        # Vendas ajustadas por promoção planejada
        vendas_ajustadas = df["vendas_diarias"] * (1 + df.get("promocao_planejada", 0))

        # Dias até ruptura projetada
        dias_ruptura = (cobertura_alvo - df["cobertura_dias"]).clip(lower=0)

        # Perda estimada em reais
        df["perda_estimada_reais"] = (
            dias_ruptura * vendas_ajustadas * df["preco_medio"]
        ).round(2)

        # Quantidade recomendada de reposição
        df["quantidade_recomendada"] = (
            ((vendas_ajustadas * cobertura_alvo) - df["estoque_atual"])
            .clip(lower=0)
            .round(0)
        )

        perda_total = df["perda_estimada_reais"].sum()
        qtd_repor_total = df["quantidade_recomendada"].sum()
        logger.info(
            f"Impacto calculado: Perda Total R${perda_total:,.2f}, Reposição Total {qtd_repor_total:.0f} un"
        )

    except Exception as e:
        logger.error(f"Erro ao calcular impacto: {str(e)}")
        raise

    return df
