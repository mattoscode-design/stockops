"""Testes das funções críticas do data_processor."""
import io
import pandas as pd
import pytest
from fastapi import HTTPException
from services.data_processor import load_file, calcular_cobertura, calcular_impacto
from services.pipeline_service import run_analysis_pipeline


def make_csv(rows: list[dict]) -> bytes:
    df = pd.DataFrame(rows)
    return df.to_csv(index=False).encode()


VALID_ROW = dict(sku="SKU-A", loja="Loja 1", estoque_atual=100, vendas_diarias=10, preco_medio=5.0)
VALID_ROW_WITH_NOME = dict(**VALID_ROW, nome="Energético 473ml")


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

    def test_nome_coluna_presente_mantem_valor(self):
        data = make_csv([VALID_ROW_WITH_NOME])
        df = load_file(data, "test.csv")
        assert "nome" in df.columns
        assert df["nome"].iloc[0] == "Energético 473ml"

    def test_nome_ausente_coluna_criada_como_nan(self):
        """load_file cria coluna nome como NaN quando ausente — pipeline faz o fallback para sku."""
        data = make_csv([VALID_ROW])
        df = load_file(data, "test.csv")
        assert "nome" in df.columns


class TestNomeFallbackPipeline:
    """Garante separação SKU/Nome e fallback compatível com planilhas antigas."""

    BASE = dict(sku="ENE-473", loja="Loja 1", estoque_atual=100,
                vendas_diarias=10, preco_medio=5.0)

    def _run(self, row: dict):
        df = pd.DataFrame([row])
        summary = run_analysis_pipeline(df)
        return summary.resultados[0]

    def test_nome_separado_do_sku(self):
        resultado = self._run({**self.BASE, "nome": "Energético 473ml"})
        assert resultado.sku == "ENE-473"
        assert resultado.nome == "Energético 473ml"

    def test_sem_coluna_nome_fallback_para_sku(self):
        """Compatibilidade retroativa: planilhas sem coluna nome usam sku como nome."""
        resultado = self._run(self.BASE)
        assert resultado.sku == "ENE-473"
        assert resultado.nome == "ENE-473"

    def test_nome_vazio_fallback_para_sku(self):
        resultado = self._run({**self.BASE, "nome": ""})
        assert resultado.nome == "ENE-473"

    def test_nome_nan_fallback_para_sku(self):
        import numpy as np
        resultado = self._run({**self.BASE, "nome": np.nan})
        assert resultado.nome == "ENE-473"


class TestReceitaPotencial:
    """F1 — receita_potencial por SKU e receita_potencial_total no summary."""

    BASE = dict(loja="Loja 1", estoque_atual=100, vendas_diarias=10, preco_medio=5.0)

    def _run(self, rows: list[dict]):
        skus = [dict(sku=f"SKU-{i}", **row) for i, row in enumerate(rows)]
        return run_analysis_pipeline(pd.DataFrame(skus))

    def test_receita_por_sku(self):
        summary = self._run([{**self.BASE, "estoque_atual": 50, "preco_medio": 10.0}])
        assert summary.resultados[0].receita_potencial == pytest.approx(500.0)

    def test_receita_zero_quando_sem_estoque(self):
        summary = self._run([{**self.BASE, "estoque_atual": 0}])
        assert summary.resultados[0].receita_potencial == pytest.approx(0.0)

    def test_receita_total_soma_todos_skus(self):
        rows = [
            {**self.BASE, "estoque_atual": 10, "preco_medio": 2.0},   # 20
            {**self.BASE, "estoque_atual": 5,  "preco_medio": 10.0},  # 50
        ]
        summary = self._run(rows)
        assert summary.receita_potencial_total == pytest.approx(70.0)

    def test_receita_total_no_summary(self):
        summary = self._run([self.BASE])
        assert hasattr(summary, "receita_potencial_total")
        assert summary.receita_potencial_total >= 0


class TestValidadeScore:
    """F2 — validade_dias_restantes no AnalysisResponse e boost +15 no score."""

    BASE = dict(loja="Loja 1", estoque_atual=100, vendas_diarias=10, preco_medio=5.0)

    def _run(self, row: dict):
        df = pd.DataFrame([dict(sku="SKU-V", **row)])
        summary = run_analysis_pipeline(df)
        return summary.resultados[0]

    def test_sem_data_validade_campo_none(self):
        resultado = self._run(self.BASE)
        assert resultado.validade_dias_restantes is None

    def test_validade_futura_alem_cobertura_sem_boost(self):
        """Validade em 30 dias, cobertura = 10 dias → não boostar."""
        from datetime import date, timedelta
        validade = (date.today() + timedelta(days=30)).isoformat()
        resultado = self._run({**self.BASE, "data_validade": validade, "estoque_atual": 100})
        assert resultado.validade_dias_restantes == 30
        # score não deve ter boost (30 > cobertura ~10)
        resultado_sem_validade = self._run(self.BASE)
        assert resultado.score_ruptura == pytest.approx(resultado_sem_validade.score_ruptura, abs=0.1)

    def test_validade_menor_que_cobertura_aplica_boost(self):
        """Validade em 3 dias, cobertura = 10 dias → boost +15."""
        from datetime import date, timedelta
        validade = (date.today() + timedelta(days=3)).isoformat()
        resultado_com = self._run({**self.BASE, "data_validade": validade})
        resultado_sem = self._run(self.BASE)
        assert resultado_com.score_ruptura == pytest.approx(
            min(100.0, resultado_sem.score_ruptura + 15), abs=0.1
        )

    def test_boost_nao_ultrapassa_100(self):
        """Score 95 + boost 15 deve ficar em 100, não 110."""
        from datetime import date, timedelta
        # Estoque zero → score máximo. Validade em 1 dia → boost aplicado
        validade = (date.today() + timedelta(days=1)).isoformat()
        resultado = self._run({**self.BASE, "estoque_atual": 0, "data_validade": validade})
        assert resultado.score_ruptura <= 100.0

    def test_validade_invalida_tratada_como_none(self):
        resultado = self._run({**self.BASE, "data_validade": "nao-e-uma-data"})
        assert resultado.validade_dias_restantes is None


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


class TestValidadeAlertaPerda:
    """Task #13 — validade_alerta e perda_validade no AnalysisResponse."""

    BASE = dict(loja="L1", estoque_atual=100, vendas_diarias=10, preco_medio=5.0)

    def _run(self, row: dict):
        from services.pipeline_service import run_analysis_pipeline
        df = pd.DataFrame([dict(sku="SKU-T", **row)])
        return run_analysis_pipeline(df).resultados[0]

    def test_sem_validade_alerta_false_perda_zero(self):
        r = self._run(self.BASE)
        assert r.validade_alerta is False
        assert r.perda_validade == 0.0

    def test_validade_futura_alem_cobertura_sem_alerta(self):
        """Estoque 100, vendas 10 → cobertura 10 dias. Validade em 30 dias → sem alerta."""
        from datetime import date, timedelta
        validade = (date.today() + timedelta(days=30)).isoformat()
        r = self._run({**self.BASE, "data_validade": validade})
        assert r.validade_alerta is False
        assert r.perda_validade == 0.0

    def test_validade_dentro_cobertura_gera_alerta_e_perda(self):
        """Estoque 100, vendas 10 → cobertura 10 dias. Validade em 5 dias → alerta.
        Perda = (100 - 10*5) * 5 = 250.
        """
        from datetime import date, timedelta
        validade = (date.today() + timedelta(days=5)).isoformat()
        r = self._run({**self.BASE, "data_validade": validade})
        assert r.validade_alerta is True
        assert r.perda_validade == pytest.approx(250.0)

    def test_perda_validade_nao_negativa(self):
        """Estoque pequeno: perda não pode ser negativa."""
        from datetime import date, timedelta
        validade = (date.today() + timedelta(days=5)).isoformat()
        r = self._run({**self.BASE, "estoque_atual": 40, "data_validade": validade})
        assert r.perda_validade >= 0.0
