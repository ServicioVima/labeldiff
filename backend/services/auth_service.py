"""Autenticación Microsoft Entra ID (Azure AD) y mapeo de grupos a roles."""
import msal
import requests
from datetime import datetime, timedelta
from typing import Optional

from backend.config import settings
from backend.models.user import User, Role


# Scopes para obtener token y leer grupos. No incluir openid/profile: MSAL los reserva.
SCOPES = ["User.Read", "email"]
GRAPH_GROUPS_URL = "https://graph.microsoft.com/v1.0/me/memberOf"


def get_auth_url(state: Optional[str] = None, redirect_uri: Optional[str] = None) -> str:
    """Genera la URL de autorización de Microsoft (Authorization Code Flow).
    redirect_uri: si se pasa (p. ej. desde request), se usa; si no, settings.AZURE_AD_REDIRECT_URI.
    """
    uri = redirect_uri or settings.AZURE_AD_REDIRECT_URI
    client = msal.ConfidentialClientApplication(
        settings.AZURE_AD_CLIENT_ID,
        authority=f"https://login.microsoftonline.com/{settings.AZURE_AD_TENANT_ID}",
        client_credential=settings.AZURE_AD_CLIENT_SECRET,
    )
    auth_url = client.get_authorization_request_url(
        scopes=SCOPES,
        redirect_uri=uri,
        state=state,
    )
    return auth_url


def get_token_from_code(code: str, redirect_uri: Optional[str] = None) -> Optional[dict]:
    """Intercambia el código por tokens. redirect_uri debe ser idéntico al usado en login."""
    uri = redirect_uri or settings.AZURE_AD_REDIRECT_URI
    client = msal.ConfidentialClientApplication(
        settings.AZURE_AD_CLIENT_ID,
        authority=f"https://login.microsoftonline.com/{settings.AZURE_AD_TENANT_ID}",
        client_credential=settings.AZURE_AD_CLIENT_SECRET,
    )
    result = client.acquire_token_by_authorization_code(
        code,
        scopes=SCOPES,
        redirect_uri=uri,
    )
    return result if result.get("access_token") else None


def get_groups_from_graph(access_token: str) -> list[str]:
    """Obtiene los IDs de grupos del usuario desde Microsoft Graph."""
    headers = {"Authorization": f"Bearer {access_token}"}
    group_ids = []
    url = GRAPH_GROUPS_URL
    while url:
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code != 200:
            break
        data = resp.json()
        for item in data.get("value", []):
            if item.get("id"):
                group_ids.append(item["id"])
        url = data.get("@odata.nextLink")
    return group_ids


def user_is_in_allowed_groups(group_ids: list[str]) -> bool:
    """True si el usuario pertenece al menos a uno de los grupos configurados (admin, user o viewer)."""
    allowed = (
        settings.group_ids_admin
        + settings.group_ids_user
        + settings.group_ids_viewer
    )
    if not allowed:
        return True  # Sin grupos configurados: permitir (comportamiento legacy)
    return any(g in allowed for g in group_ids)


def role_from_groups(group_ids: list[str]) -> Role:
    """Asigna un rol por prioridad: admin > user > viewer según pertenencia a grupos."""
    if any(g in settings.group_ids_admin for g in group_ids):
        return Role.admin
    if any(g in settings.group_ids_user for g in group_ids):
        return Role.user
    if any(g in settings.group_ids_viewer for g in group_ids):
        return Role.viewer
    return Role.viewer  # Por defecto viewer si no está en ningún grupo configurado


def user_info_from_token(token: dict) -> dict:
    """Extrae email, nombre y oid del id_token o access_token (claims)."""
    import jwt
    id_token_raw = token.get("id_token")
    if id_token_raw:
        try:
            # Decodificar sin verificación (el token viene del flujo que nosotros iniciamos)
            id_token = jwt.decode(id_token_raw, options={"verify_signature": False})
            if id_token:
                return {
                    "email": id_token.get("preferred_username") or id_token.get("email") or "",
                    "name": id_token.get("name") or id_token.get("preferred_username") or "Usuario",
                    "oid": id_token.get("oid"),
                }
        except Exception:
            pass
    # Fallback: llamar a Graph /me
    headers = {"Authorization": f"Bearer {token.get('access_token')}"}
    r = requests.get("https://graph.microsoft.com/v1.0/me", headers=headers, timeout=10)
    if r.status_code == 200:
        me = r.json()
        return {
            "email": me.get("mail") or me.get("userPrincipalName") or "",
            "name": me.get("displayName") or "Usuario",
            "oid": me.get("id"),
        }
    return {"email": "", "name": "Usuario", "oid": None}
