"""Sesión mediante JWT en cookie HttpOnly (o en header)."""
from datetime import datetime, timedelta
from typing import Optional

import jwt
from jwt import PyJWKClient

from backend.config import settings
from backend.models.user import User, Role


# Para validar tokens de Entra ID se usa el JWKS del tenant; para nuestros propios JWTs usamos SECRET_KEY
def create_session_token(user_id: int, email: str, role: Role) -> str:
    """Crea un JWT firmado con SECRET_KEY para la sesión (cookie)."""
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role.value,
        "exp": datetime.utcnow() + timedelta(days=1),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm="HS256",
    )


def decode_session_token(token: str) -> Optional[dict]:
    """Decodifica y valida el JWT de sesión."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=["HS256"],
        )
        return payload
    except Exception:
        return None
