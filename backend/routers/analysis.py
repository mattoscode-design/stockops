from fastapi import APIRouter, UploadFile, File, Depends, Request, HTTPException
from models.schemas import AnalysisSummary
from middleware.auth import get_current_user
from middleware.rate_limit import limiter
from services.data_processor import load_file
from services.pipeline_service import run_analysis_pipeline
from routers.analyses import save_analysis

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
    summary = run_analysis_pipeline(df)

    # Persistência não-bloqueante: falha no save não interrompe a resposta
    tenant_id = current_user.get("tenant_id")
    if tenant_id:
        save_analysis(summary, tenant_id, current_user.get("user_id"))

    return summary
