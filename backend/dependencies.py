"""Dependencias FastAPI: sesión y permisos."""
from datetime import datetime

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from backend.config import settings
from backend.models.user import User, Role
from backend.services.jwt_session import decode_session_token

bearer = HTTPBearer(auto_error=False)


def _dev_fake_user() -> User | None:
    """Usuario ficticio para desarrollo cuando DEV_SKIP_AUTH=True."""
    if not settings.DEV_SKIP_AUTH:
        return None
    return User(
        id=1,
        email="dev@local",
        name="Dev Local",
        role=Role.admin,
        last_login=None,
        azure_oid=None,
        created_at=datetime.utcnow(),
    )


async def get_current_user_optional(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> User | None:
    """Obtiene el usuario actual si hay sesión; si no, retorna None (o usuario dev si DEV_SKIP_AUTH)."""
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if credentials and credentials.credentials:
        token = credentials.credentials
    if not token:
        return _dev_fake_user()
    payload = decode_session_token(token)
    if not payload:
        return _dev_fake_user()
    from backend.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        user = await db.get(User, int(payload["sub"]))
        return user


async def get_current_user(
    user: User | None = Depends(get_current_user_optional),
) -> User:
    """Exige usuario autenticado."""
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
        )
    return user


def require_role(*allowed: Role):
    """Dependencia que exige uno de los roles indicados."""
    async def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sin permisos",
            )
        return user
    return _check


RequireAdmin = Depends(require_role(Role.admin))
