from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field, field_validator


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
    validade_alerta: bool = False
    perda_validade: float = 0.0
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


class UserRegister(BaseModel):
    email: str
    password: str
    username: Optional[str] = None
    nome_exibicao: Optional[str] = None
    tipo_perfil: str = "colaborador"
    empresa_nome: Optional[str] = None
    # tenant_id mantido por compatibilidade com clientes antigos — ignorado no registro
    tenant_id: Optional[str] = None

    @field_validator("email", "password")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Campo obrigatório")
        return v

    @field_validator("tipo_perfil")
    @classmethod
    def valid_tipo_perfil(cls, v: str) -> str:
        if v not in ("empresa", "colaborador"):
            raise ValueError("tipo_perfil deve ser 'empresa' ou 'colaborador'")
        return v


class UserLogin(BaseModel):
    email: str
    password: str

    @field_validator("email", "password")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Campo obrigatório")
        return v


class OTPVerify(BaseModel):
    email: str
    token: str

    @field_validator("email", "token")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Campo obrigatório")
        return v


class ForgotPassword(BaseModel):
    email: str


class ResetPassword(BaseModel):
    access_token: str
    new_password: str = Field(min_length=6)


class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    nome_exibicao: Optional[str] = None
    tipo_perfil: Optional[str] = None
    empresa_nome: Optional[str] = None


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


# ── Tenant management ────────────────────────────────────────


class TenantResponse(BaseModel):
    id: str
    name: str
    slug: str
    plan: str


class TenantMemberResponse(BaseModel):
    id: str
    email: str
    username: Optional[str] = None
    nome_exibicao: Optional[str] = None
    role: str
    tipo_perfil: Optional[str] = None


class InviteCreate(BaseModel):
    email: str
    role: str = "viewer"

    @field_validator("email")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Email obrigatório")
        return v

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        if v not in ("admin", "viewer"):
            raise ValueError("role deve ser 'admin' ou 'viewer'")
        return v


class InviteAccept(BaseModel):
    token: str

    @field_validator("token")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Token obrigatório")
        return v


class JoinRequestCreate(BaseModel):
    tenant_id: str
    message: Optional[str] = None

    @field_validator("tenant_id")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("tenant_id obrigatório")
        return v


class JoinRequestResponse(BaseModel):
    id: str
    tenant_id: str
    user_id: str
    status: str
    message: Optional[str] = None
    created_at: str
