"""
Punto de entrada: monta la API en /api y sirve el frontend React desde la raíz.
Para producción en Azure App Service.
"""
import os
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from backend.app import create_app

# Ruta al build del frontend (Vite output)
DIST_PATH = Path(__file__).parent / "frontend" / "dist"

app = create_app()

# CORS para desarrollo y para que el frontend en mismo origen no lo necesite en prod
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:8000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montar archivos estáticos del frontend en la raíz (solo si existe dist)
if DIST_PATH.exists():
    app.mount("/", StaticFiles(directory=str(DIST_PATH), html=True), name="frontend")
else:
    # Fallback si frontend/dist no está en el deploy (evita 404 JSON en la raíz)
    @app.get("/")
    def _root():
        return HTMLResponse(
            status_code=200,
            content="""<!DOCTYPE html><html><head><meta charset="utf-8"><title>LabelDiff</title></head><body style="font-family:sans-serif;padding:2rem;">
            <h1>LabelDiff</h1>
            <p>El frontend no está desplegado en este entorno (falta <code>frontend/dist</code>).</p>
            <p>Asegúrate de que el workflow de GitHub Actions construye el frontend y despliega el repo completo.</p>
            <p><a href="/api/health">Comprobar API</a></p>
            </body></html>""",
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("ENV", "development") == "development",
    )
