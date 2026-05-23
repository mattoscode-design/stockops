from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, field_validator


class AnalysisResponse(BaseModel):
    sku: str
    nome: str
    ean: Optional[str] = None
    loja: str
    categoria: str
    cobertura_dias: float
    score_ruptura: float
    classificacao: str
    curva_abc: str
    perda_estimada_reais: float
    quantidade_recomendada: float
    receita_potencial: float
    validade_dias_restantes: Optional[int] = None
    insight: str
    recomendacao: str


class AnalysisSummary(BaseModel):
    total_skus: int
    skus_criticos: int
    perda_total_estimada: float
    receita_potencial_total: float
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


class AnalysisRecord(BaseModel):
    """Representa uma análise persistida no Supabase (resposta dos endpoints GET)."""
    id: str
    tenant_id: str
    user_id: str | None = None
    created_at: str
    updated_at: str | None = None
    total_skus: int
    skus_criticos: int
    perda_total_estimada: float
    relatorio: str
    resultados: list[dict]
    items_snapshot: list[dict] | None = None


class InventoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

    @field_validator("name")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Nome não pode ser vazio")
        return v


class InventoryResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    description: Optional[str] = None
    active: bool = False
    created_at: str


class InventoryItemCreate(BaseModel):
    sku: str
    nome: Optional[str] = None
    ean: Optional[str] = None
    loja: str
    categoria: str = "Sem Categoria"
    estoque_atual: float
    vendas_diarias: float
    preco_medio: float
    inventory_id: Optional[str] = None


class InventoryItemUpdate(BaseModel):
    sku: str | None = None
    nome: str | None = None
    ean: str | None = None
    loja: str | None = None
    categoria: str | None = None
    estoque_atual: float | None = None
    vendas_diarias: float | None = None
    preco_medio: float | None = None
    inventory_id: str | None = None


class MovementCreate(BaseModel):
    tipo: str
    quantidade: float
    motivo: str | None = None

    @field_validator("tipo")
    @classmethod
    def valid_tipo(cls, v: str) -> str:
        if v not in ("entrada", "saida"):
            raise ValueError("tipo deve ser 'entrada' ou 'saida'")
        return v
