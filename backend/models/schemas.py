from pydantic import BaseModel, field_validator


class AnalysisResponse(BaseModel):
    sku: str
    loja: str
    categoria: str
    cobertura_dias: float
    score_ruptura: float
    classificacao: str
    curva_abc: str
    perda_estimada_reais: float
    quantidade_recomendada: float
    insight: str
    recomendacao: str


class AnalysisSummary(BaseModel):
    total_skus: int
    skus_criticos: int
    perda_total_estimada: float
    categorias: list[str]
    relatorio: str
    resultados: list[AnalysisResponse]


class Token(BaseModel):
    access_token: str
    token_type: str


class UserLogin(BaseModel):
    username: str
    password: str

    @field_validator("username", "password")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Campo obrigatório")
        return v
