"""Flujo OAuth 2.0 Microsoft Entra ID: login y callback."""
from fastapi import APIRouter, Depends, Query, Response, Request
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
)
from backend.services.jwt_session import create_session_token
from backend.config import settings

router = APIRouter()


@router.get("/login")
async def login(
    state: str | None = Query(None),
    response: Response = None,
):
    """Redirige al usuario a Microsoft para iniciar sesión."""
    url = get_auth_url(state=state)
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=url, status_code=302)


@router.get("/callback")
async def callback(
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
    request: Request = None,
    response: Response = None,
):
    """Intercambia el código por token, crea/actualiza usuario, registra log y setea cookie."""
    from fastapi.responses import RedirectResponse
    base = str(request.base_url).rstrip("/")
    frontend_base = base
    # Redirect final al frontend (raíz o / si está detrás de proxy)
    redirect_url = f"{frontend_base}/"
    if error:
        redirect_url = f"{frontend_base}/?error=login_failed"
        return RedirectResponse(url=redirect_url, status_code=302)
    if not code:
        return RedirectResponse(url=f"{redirect_url}?error=no_code", status_code=302)

    token = get_token_from_code(code)
    if not token:
        return RedirectResponse(url=f"{redirect_url}?error=token_failed", status_code=302)

    info = user_info_from_token(token)
    if not info.get("email"):
        return RedirectResponse(url=f"{redirect_url}?error=no_email", status_code=302)

    group_ids = get_groups_from_graph(token["access_token"])
    role = role_from_groups(group_ids)

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
        user_id = user.id

    session_jwt = create_session_token(user.id, user.email, user.role)
    # Cookie HttpOnly, SameSite para Azure (cross-site = None)
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
