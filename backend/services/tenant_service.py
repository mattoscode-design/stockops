"""
Tenant Service — Utilitários para criação e gestão de tenants.

Centraliza a lógica de geração de slug e criação de tenant para evitar
duplicação entre routers/auth.py e routers/tenants.py.
"""

import logging
import re
import uuid

from fastapi import HTTPException

from db.supabase_client import supabase

logger = logging.getLogger("stockops.tenant_service")


def generate_slug(name: str) -> str:
    """Converte nome em slug URL-safe: lowercase, alnum+hifens, máx 50 chars."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower().strip())
    slug = slug.strip("-")[:50]
    return slug or "tenant"


def ensure_unique_slug(base_slug: str) -> str:
    """
    Garante unicidade do slug adicionando sufixo numérico se necessário.
    Tenta até 100 variações antes de usar UUID como fallback.
    """
    slug = base_slug
    counter = 1
    while True:
        existing = (
            supabase.table("tenants")
            .select("id")
            .eq("slug", slug)
            .limit(1)
            .execute()
        )
        if not existing.data:
            return slug
        slug = f"{base_slug[:46]}-{counter}"
        counter += 1
        if counter > 100:
            return f"{base_slug[:40]}-{uuid.uuid4().hex[:8]}"


def create_tenant(name: str, plan: str = "free", slug_suffix: str | None = None) -> str:
    """
    Cria tenant com nome e plano especificados.

    slug_suffix: quando fornecido (ex: auth_id[:8]), o slug é gerado como
    ``{slugify(name)}-{slug_suffix}`` sem verificação de unicidade prévia
    (sufixo de 8 chars de UUID garante entropia suficiente).
    Sem sufixo, usa ensure_unique_slug com fallback numérico.

    Retorna o UUID do tenant criado.

    Raises:
        HTTPException 500: se o INSERT falhar.
    """
    base = generate_slug(name)
    slug = f"{base[:41]}-{slug_suffix}" if slug_suffix else ensure_unique_slug(base)

    result = (
        supabase.table("tenants")
        .insert({"name": name, "slug": slug, "plan": plan})
        .execute()
    )
    if not result.data:
        logger.error(f"Falha ao criar tenant name={name!r} slug={slug!r}")
        raise HTTPException(status_code=500, detail="Erro ao criar tenant")

    tenant_id = str(result.data[0]["id"])
    logger.info(f"Tenant criado: id={tenant_id} name={name!r} slug={slug!r}")
    return tenant_id
