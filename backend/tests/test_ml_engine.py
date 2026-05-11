"""Testes das funções críticas do ml_engine — score, classificação e curva ABC."""
import pandas as pd
import pytest
from services.ml_engine import calcular_score, classificar_risco, aplicar_classificacao, calcular_curva_abc


def make_df(**kwargs) -> pd.DataFrame:
    base = dict(cobertura_dias=14.0, aceleracao=False)
    base.update(kwargs)
    return pd.DataFrame([base])


class TestClassificarRisco:
    def test_urgente(self):     assert classificar_risco(90)  == "Urgente"
    def test_acao(self):        assert classificar_risco(75)  == "Ação Recomendada"
    def test_alerta(self):      assert classificar_risco(60)  == "Alerta"
    def test_monitoramento(self):assert classificar_risco(30) == "Monitoramento"
    def test_limite_urgente(self):    assert classificar_risco(86) == "Urgente"
    def test_limite_acao(self):       assert classificar_risco(71) == "Ação Recomendada"
    def test_limite_alerta(self):     assert classificar_risco(51) == "Alerta"
    def test_limite_monitoramento(self): assert classificar_risco(50) == "Monitoramento"


class TestCalcularScore:
    def test_cobertura_zero_eleva_score(self):
        # Cobertura 0 + pesos padrão (sem aceleração) → score ≈ 47
        # Com aceleração sobe para ~77
        df = make_df(cobertura_dias=0, aceleracao=True)
        result = calcular_score(df)
        assert result["score_ruptura"].iloc[0] > 60

    def test_cobertura_maxima_reduz_score(self):
        df = make_df(cobertura_dias=14)
        result = calcular_score(df)
        assert result["score_ruptura"].iloc[0] < 50

    def test_aceleracao_eleva_score(self):
        df_sem = make_df(cobertura_dias=7, aceleracao=False)
        df_com = make_df(cobertura_dias=7, aceleracao=True)
        score_sem = calcular_score(df_sem)["score_ruptura"].iloc[0]
        score_com = calcular_score(df_com)["score_ruptura"].iloc[0]
        assert score_com > score_sem

    def test_score_entre_zero_e_cem(self):
        for cob in [0, 3, 7, 14]:
            df = make_df(cobertura_dias=cob)
            score = calcular_score(df)["score_ruptura"].iloc[0]
            assert 0 <= score <= 100, f"Score {score} fora do range para cobertura {cob}"


class TestCurvaABC:
    def test_sem_perda_tudo_c(self):
        df = pd.DataFrame([
            {"sku":"A","perda_estimada_reais":0},
            {"sku":"B","perda_estimada_reais":0},
        ])
        result = calcular_curva_abc(df)
        assert (result["curva_abc"] == "C").all()

    def test_pareto_80_20(self):
        df = pd.DataFrame([
            {"sku":"Top",   "perda_estimada_reais":800},
            {"sku":"Mid",   "perda_estimada_reais":150},
            {"sku":"Low",   "perda_estimada_reais":50},
        ])
        result = calcular_curva_abc(df)
        assert result.loc[result["sku"] == "Top",  "curva_abc"].iloc[0] == "A"
        assert result.loc[result["sku"] == "Mid",  "curva_abc"].iloc[0] == "B"
        assert result.loc[result["sku"] == "Low",  "curva_abc"].iloc[0] == "C"

    def test_resultado_apenas_abc(self):
        df = pd.DataFrame([{"sku":str(i),"perda_estimada_reais":float(i*10)} for i in range(10)])
        result = calcular_curva_abc(df)
        assert set(result["curva_abc"].unique()).issubset({"A","B","C"})
