"""Configuración desde variables de entorno."""
import os
from typing import List

def _str_list(value: str) -> List[str]:
    if not value:
        return []
    return [x.strip() for x in value.split(",") if x.strip()]

class Settings:
    # App
    ENV: str = os.getenv("ENV", "development")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production")
    # Local: si True, no exige login (usuario dev ficticio). Solo para desarrollo.
    DEV_SKIP_AUTH: bool = os.getenv("DEV_SKIP_AUTH", "false").lower() == "true"
    
    # Database (Azure Database for PostgreSQL)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://user:pass@localhost:5432/labeldiff"
    )
    
    # Azure AD (Microsoft Entra ID)
    AZURE_AD_CLIENT_ID: str = os.getenv("AZURE_AD_CLIENT_ID", "")
    AZURE_AD_CLIENT_SECRET: str = os.getenv("AZURE_AD_CLIENT_SECRET", "")
    AZURE_AD_TENANT_ID: str = os.getenv("AZURE_AD_TENANT_ID", "")
    AZURE_AD_REDIRECT_URI: str = os.getenv("AZURE_AD_REDIRECT_URI", "http://localhost:8000/api/auth/callback")
    # Grupos -> rol (prioridad: admin > user > viewer). IDs de grupo separados por coma.
    AZURE_AD_GROUP_ADMIN: str = os.getenv("AZURE_AD_GROUP_ADMIN", "")   # IDs separados por coma
    AZURE_AD_GROUP_USER: str = os.getenv("AZURE_AD_GROUP_USER", "")
    AZURE_AD_GROUP_VIEWER: str = os.getenv("AZURE_AD_GROUP_VIEWER", "")
    
    # JWT / Session
    JWT_ALGORITHM: str = "RS256"  # Entra ID usa RS256
    JWT_AUDIENCE: str = os.getenv("AZURE_AD_CLIENT_ID", "")
    SESSION_COOKIE_NAME: str = "labeldiff_session"
    SESSION_HTTP_ONLY: bool = True
    SESSION_SAME_SITE: str = os.getenv("SESSION_SAME_SITE", "lax")  # "none" para cross-site en Azure
    SESSION_SECURE: bool = os.getenv("SESSION_SECURE", "false").lower() == "true"
    
    # Azure Blob Storage
    AZURE_STORAGE_CONNECTION_STRING: str = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
    AZURE_STORAGE_CONTAINER: str = os.getenv("AZURE_STORAGE_CONTAINER", "etiquetas")
    SAS_EXPIRY_MINUTES: int = int(os.getenv("SAS_EXPIRY_MINUTES", "60"))
    
    # Gemini (config para el frontend; el frontend llama a Gemini con @google/genai)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_API_KEY_EXPOSE: bool = os.getenv("GEMINI_API_KEY_EXPOSE", "false").lower() == "true"
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    
    @property
    def group_ids_admin(self) -> List[str]:
        return _str_list(self.AZURE_AD_GROUP_ADMIN)
    
    @property
    def group_ids_user(self) -> List[str]:
        return _str_list(self.AZURE_AD_GROUP_USER)
    
    @property
    def group_ids_viewer(self) -> List[str]:
        return _str_list(self.AZURE_AD_GROUP_VIEWER)

settings = Settings()
