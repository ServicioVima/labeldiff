"""Aplicación FastAPI: rutas bajo /api."""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from backend.config import settings
from backend.database import init_db, close_db
from backend.routes import health, auth, catalog, logs, email_report


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_db()
    except Exception as e:
        import logging
        logging.warning("init_db falló (¿PostgreSQL corriendo?): %s. Algunas rutas pueden fallar.", e)
    try:
        yield
    finally:
        await close_db()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Vima Etiquetas API",
        description="Comparación Visual de Etiquetas con IA",
        version="1.0.0",
        lifespan=lifespan,
    )
    
    app.include_router(health.router, prefix="/api", tags=["health"])
    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(catalog.router, prefix="/api/catalog", tags=["catalog"])
    app.include_router(logs.router, prefix="/api/logs", tags=["logs"])
    app.include_router(email_report.router, prefix="/api/email", tags=["email"])

    return app
