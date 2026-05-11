from fastapi import APIRouter, UploadFile, File, Depends, Request, HTTPException
from models.schemas import AnalysisSummary, AnalysisResponse
from middleware.auth import get_current_user
from middleware.rate_limit import limiter
from services.data_processor import load_file, calcular_cobertura, detectar_aceleracao, calcular_impacto
from services.ml_engine import calcular_score, aplicar_classificacao, calcular_curva_abc
from services.report_service import gerar_relatorio, gerar_insight_estatico

router = APIRouter(prefix="/analysis", tags=["analysis"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/upload", response_model=AnalysisSummary)
@limiter.limit("30/minute")
async def upload_and_analyze(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    filename = file.filename or ""
    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Arquivo excede o limite de 10 MB")

    df = load_file(content, filename)
    df = calcular_cobertura(df)
    df = detectar_aceleracao(df)
    df = calcular_impacto(df)
    df = calcular_score(df)
    df = aplicar_classificacao(df)
    df = calcular_curva_abc(df)

    resultados = []
    for row in df.to_dict("records"):
        insight, recomendacao = gerar_insight_estatico(
            classificacao=row["classificacao"],
            cobertura=row["cobertura_dias"],
            perda=row["perda_estimada_reais"],
            quantidade=row["quantidade_recomendada"],
        )
        resultados.append(AnalysisResponse(
            sku=str(row["sku"]),
            loja=str(row["loja"]),
            categoria=str(row.get("categoria", "Sem Categoria")),
            cobertura_dias=row["cobertura_dias"],
            score_ruptura=row["score_ruptura"],
            classificacao=row["classificacao"],
            curva_abc=str(row.get("curva_abc", "C")),
            perda_estimada_reais=row["perda_estimada_reais"],
            quantidade_recomendada=row["quantidade_recomendada"],
            insight=insight,
            recomendacao=recomendacao,
        ))

    criticos = [r for r in resultados if r.score_ruptura >= 71]
    perda_total = sum(r.perda_estimada_reais for r in resultados)
    categorias = sorted({r.categoria for r in resultados})
    resultados_sorted = sorted(resultados, key=lambda x: x.score_ruptura, reverse=True)

    summary_dict = {
        "total_skus": len(resultados),
        "skus_criticos": len(criticos),
        "perda_total_estimada": round(perda_total, 2),
        "categorias": categorias,
        "resultados": [r.model_dump() for r in resultados_sorted],
    }
    relatorio = gerar_relatorio(summary_dict)

    return AnalysisSummary(
        total_skus=len(resultados),
        skus_criticos=len(criticos),
        perda_total_estimada=round(perda_total, 2),
        categorias=categorias,
        relatorio=relatorio,
        resultados=resultados_sorted,
    )
