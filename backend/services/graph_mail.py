"""Envío de correo vía Microsoft Graph (permiso Mail.Send de la app)."""
import base64
from typing import Optional

import msal
import requests

from backend.config import settings

GRAPH_SENDMAIL_URL = "https://graph.microsoft.com/v1.0/users/{user_id}/sendMail"
SCOPE = ["https://graph.microsoft.com/.default"]


def get_app_token_for_graph() -> Optional[str]:
    """Obtiene un access token de aplicación (client credentials) para Microsoft Graph.
    La app debe tener el permiso Mail.Send (aplicación) con consentimiento de admin.
    """
    if not settings.AZURE_AD_CLIENT_ID or not settings.AZURE_AD_CLIENT_SECRET or not settings.AZURE_AD_TENANT_ID:
        return None
    app = msal.ConfidentialClientApplication(
        settings.AZURE_AD_CLIENT_ID,
        authority=f"https://login.microsoftonline.com/{settings.AZURE_AD_TENANT_ID}",
        client_credential=settings.AZURE_AD_CLIENT_SECRET,
    )
    result = app.acquire_token_for_client(scopes=SCOPE)
    return result.get("access_token") if result else None


def send_mail_via_graph(
    *,
    from_user: str,
    to_email: str,
    subject: str,
    html_body: str,
    attachments: list[dict],
) -> None:
    """
    Envía un correo usando Microsoft Graph (sendMail).
    from_user: UPN o id del usuario/buzón desde el que se envía (ej. administracion.compras@vimafoods.com).
    to_email: dirección del destinatario.
    attachments: lista de { "filename", "contentBase64", "contentId" | None }.
    """
    token = get_app_token_for_graph()
    if not token:
        raise RuntimeError("No se pudo obtener token de Graph. Compruebe AZURE_AD_* y permiso Mail.Send.")

    # Adjuntos: inline (cid) para el cuerpo y copia como archivo descargable
    graph_attachments = []
    for att in attachments:
        filename = att.get("filename") or "attachment.png"
        b64 = att.get("contentBase64") or ""
        content_id = att.get("contentId")
        if not b64:
            continue
        raw_b64 = b64.split(",")[-1] if "," in b64 else b64
        if content_id:
            graph_attachments.append({
                "@odata.type": "#microsoft.graph.fileAttachment",
                "name": filename,
                "contentBytes": raw_b64,
                "contentType": "image/png",
                "contentId": content_id,
                "isInline": True,
            })
        graph_attachments.append({
            "@odata.type": "#microsoft.graph.fileAttachment",
            "name": filename,
            "contentBytes": raw_b64,
            "contentType": "image/png",
        })

    url = GRAPH_SENDMAIL_URL.format(user_id=from_user)
    payload = {
        "message": {
            "subject": subject,
            "body": {
                "contentType": "HTML",
                "content": html_body,
            },
            "toRecipients": [
                {
                    "emailAddress": {
                        "address": to_email,
                        "name": to_email,
                    }
                }
            ],
            "attachments": graph_attachments,
        },
        "saveToSentItems": True,
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=30)
    if resp.status_code not in (200, 202):
        raise RuntimeError(f"Graph sendMail error: {resp.status_code} - {resp.text}")
