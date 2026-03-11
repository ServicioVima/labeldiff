from fastapi import APIRouter

from backend.config import settings

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "service": "labeldiff-api"}


@router.get("/config")
async def config():
    """Configuración para el frontend: modelo Gemini, etc. La API key la inyecta el backend en build o env."""
    out = {"geminiModel": settings.GEMINI_MODEL}
    if settings.GEMINI_API_KEY_EXPOSE:
        out["geminiApiKey"] = settings.GEMINI_API_KEY
    return out
