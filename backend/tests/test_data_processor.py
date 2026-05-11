"""Testes das funções críticas do data_processor."""
import io
import pandas as pd
import pytest
from fastapi import HTTPException
from services.data_processor import load_file, calcular_cobertura, calcular_impacto


def make_csv(rows: list[dict]) -> bytes:
    df = pd.DataFrame(rows)
    return df.to_csv(index=False).encode()


VALID_ROW = dict(sku="SKU-A", loja="Loja 1", estoque_atual=100, vendas_diarias=10, preco_medio=5.0)


class TestLoadFile:
    def test_csv_valido(self):
        data = make_csv([VALID_ROW])
        df = load_file(data, "test.csv")
        assert len(df) == 1
        assert "sku" in df.columns

    def test_formato_invalido_lanca_erro(self):
        with pytest.raises(HTTPException) as exc:
            load_file(b"data", "arquivo.pdf")
        assert exc.value.status_code == 400

    def test_coluna_faltando_lanca_422(self):
        row = {k: v for k, v in VALID_ROW.items() if k != "preco_medio"}
        data = make_csv([row])
        with pytest.raises(HTTPException) as exc:
            load_file(data, "test.csv")
        assert exc.value.status_code == 422
        assert "preco_medio" in exc.value.detail

    def test_colunas_normalizadas(self):
        row = {"SKU": "A", "Loja": "B", "Estoque Atual": 10, "Vendas Diarias": 5, "Preco Medio": 3.0}
        data = make_csv([row])
        df = load_file(data, "test.csv")
        assert "estoque_atual" in df.columns

    def test_categoria_padrao_sem_categoria(self):
        data = make_csv([VALID_ROW])
        df = load_file(data, "test.csv")
        assert "categoria" in df.columns
        assert df["categoria"].iloc[0] == "Sem Categoria"


class TestCalcularCobertura:
    def test_cobertura_normal(self):
        df = pd.DataFrame([{"estoque_atual": 100, "vendas_diarias": 10}])
        result = calcular_cobertura(df)
        assert result["cobertura_dias"].iloc[0] == 10.0

    def test_vendas_zero_resulta_zero(self):
        df = pd.DataFrame([{"estoque_atual": 50, "vendas_diarias": 0}])
        result = calcular_cobertura(df)
        assert result["cobertura_dias"].iloc[0] == 0.0

    def test_estoque_zero(self):
        df = pd.DataFrame([{"estoque_atual": 0, "vendas_diarias": 10}])
        result = calcular_cobertura(df)
        assert result["cobertura_dias"].iloc[0] == 0.0


class TestCalcularImpacto:
    def _row(self, **kwargs) -> dict:
        base = dict(cobertura_dias=0, vendas_diarias=10, preco_medio=5.0,
                    promocao_planejada=0.0, estoque_atual=0)
        base.update(kwargs)
        return base

    def test_impacto_financeiro_basico(self):
        df = pd.DataFrame([self._row(cobertura_dias=0, estoque_atual=0)])
        result = calcular_impacto(df)
        # 14 dias * 10 vendas * R$5 = R$700
        assert result["perda_estimada_reais"].iloc[0] == pytest.approx(700.0)

    def test_sem_ruptura_sem_perda(self):
        df = pd.DataFrame([self._row(cobertura_dias=14, estoque_atual=140)])
        result = calcular_impacto(df)
        assert result["perda_estimada_reais"].iloc[0] == 0.0

    def test_promocao_aumenta_impacto(self):
        df_base  = calcular_impacto(pd.DataFrame([self._row(promocao_planejada=0.0)]))
        df_promo = calcular_impacto(pd.DataFrame([self._row(promocao_planejada=0.5)]))
        assert df_promo["perda_estimada_reais"].iloc[0] > df_base["perda_estimada_reais"].iloc[0]
