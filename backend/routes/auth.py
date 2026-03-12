"""Flujo OAuth 2.0 Microsoft Entra ID: login y callback."""
import logging
from urllib.parse import quote
from fastapi import APIRouter, Depends, Query, Response, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from datetime import datetime

from backend.database import AsyncSessionLocal
from backend.dependencies import get_current_user_optional
from backend.models.user import User, Role
from backend.models.audit import UserLog, UserLogAction
from backend.services.auth_service import (
    get_auth_url,
    get_token_from_code,
    get_groups_from_graph,
    role_from_groups,
    user_info_from_token,
    user_is_in_allowed_groups,
)
from backend.services.jwt_session import create_session_token
from backend.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


def _base_url_from_request(request: Request) -> str:
    """URL base pública: usa X-Forwarded-Proto y Host si está detrás de proxy (Azure App Service)."""
    if not request:
        return ""
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "https"
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    if not host:
        return str(request.base_url).rstrip("/")
    return f"{proto}://{host}".rstrip("/")


@router.get("/login")
async def login(
    state: str | None = Query(None),
    request: Request = None,
):
    """Redirige al usuario a Microsoft para iniciar sesión (302). redirect_uri se construye desde la request."""
    base = _base_url_from_request(request)
    if not (settings.AZURE_AD_CLIENT_ID and settings.AZURE_AD_TENANT_ID and settings.AZURE_AD_CLIENT_SECRET):
        logger.warning("Login: faltan variables Azure AD (CLIENT_ID, TENANT_ID o CLIENT_SECRET)")
        return RedirectResponse(url=f"{base}/?error=auth_misconfigured", status_code=302)
    redirect_uri = f"{base}/api/auth/callback"
    try:
        url = get_auth_url(state=state, redirect_uri=redirect_uri)
        return RedirectResponse(url=url, status_code=302)
    except Exception:
        logger.exception("Login: error al generar URL de Microsoft")
        return RedirectResponse(url=f"{base}/?error=login_failed", status_code=302)


@router.get("/callback")
async def callback(
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
    request: Request = None,
    response: Response = None,
):
    """Intercambia el código por token, crea/actualiza usuario, registra log y setea cookie.
    redirect_uri debe ser idéntico al usado en /login (misma URL pública).
    """
    base = _base_url_from_request(request)
    redirect_url = f"{base}/"
    # Microsoft devolvió error en el callback (ej. access_denied, consent_required)
    if error:
        reason = quote(error or "", safe="")
        return RedirectResponse(url=f"{redirect_url}?error=login_failed&reason={reason}", status_code=302)
    if not code:
        return RedirectResponse(url=f"{redirect_url}?error=no_code", status_code=302)

    redirect_uri = f"{base}/api/auth/callback"
    try:
        token = get_token_from_code(code, redirect_uri=redirect_uri)
    except Exception as e:
        logger.exception("Callback: error al intercambiar código por token")
        return RedirectResponse(url=f"{redirect_url}?error=token_failed", status_code=302)
    if not token:
        return RedirectResponse(url=f"{redirect_url}?error=token_failed", status_code=302)

    try:
        info = user_info_from_token(token)
    except Exception:
        logger.exception("Callback: error al obtener info del token")
        return RedirectResponse(url=f"{redirect_url}?error=no_email", status_code=302)
    if not info.get("email"):
        return RedirectResponse(url=f"{redirect_url}?error=no_email", status_code=302)

    try:
        group_ids = get_groups_from_graph(token["access_token"])
    except Exception:
        logger.exception("Callback: error al obtener grupos de Graph")
        group_ids = []
    if not user_is_in_allowed_groups(group_ids):
        return RedirectResponse(url=f"{redirect_url}?error=no_access", status_code=302)
    role = role_from_groups(group_ids)

    try:
        async with AsyncSessionLocal() as db:
            existing = await db.execute(
                select(User).where(
                    (User.email == info["email"]) | (User.azure_oid == info.get("oid"))
                )
            )
            user = existing.scalar_one_or_none()
            if user:
                user.name = info["name"]
                user.last_login = datetime.utcnow()
                user.role = role
                if info.get("oid"):
                    user.azure_oid = info["oid"]
            else:
                user = User(
                    email=info["email"],
                    name=info["name"],
                    role=role,
                    azure_oid=info.get("oid"),
                    last_login=datetime.utcnow(),
                )
                db.add(user)
            await db.flush()
            await db.refresh(user)

            log = UserLog(
                user_id=user.id,
                action=UserLogAction.login,
                details=f"Login from Entra ID; role={role.value}",
                ip_address=request.client.host if request.client else None,
            )
            db.add(log)
            await db.commit()
    except Exception:
        logger.exception("Callback: error de base de datos")
        return RedirectResponse(url=f"{redirect_url}?error=callback_failed", status_code=302)

    try:
        session_jwt = create_session_token(user.id, user.email, user.role)
    except Exception:
        logger.exception("Callback: error al crear sesión JWT")
        return RedirectResponse(url=f"{redirect_url}?error=callback_failed", status_code=302)

    response = RedirectResponse(url=redirect_url, status_code=302)
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=session_jwt,
        httponly=settings.SESSION_HTTP_ONLY,
        samesite=settings.SESSION_SAME_SITE,
        secure=settings.SESSION_SECURE,
        max_age=86400,
        path="/",
    )
    return response


@router.get("/logout")
async def logout(request: Request = None):
    """Borra la cookie de sesión y redirige a la raíz. El usuario verá la pantalla de login."""
    base = _base_url_from_request(request)
    redirect_url = f"{base}/"
    res = RedirectResponse(url=redirect_url, status_code=302)
    res.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/",
        httponly=settings.SESSION_HTTP_ONLY,
        samesite=settings.SESSION_SAME_SITE,
        secure=settings.SESSION_SECURE,
    )
    return res


@router.get("/me")
async def me(user: User | None = Depends(get_current_user_optional)):
    """Devuelve usuario actual si hay sesión (cookie o Bearer)."""
    if user is None:
        return {"authenticated": False}
    return {
        "authenticated": True,
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role.value,
    }
