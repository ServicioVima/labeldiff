"""Envío de correo con resumen de comparación al usuario logueado vía Microsoft Graph (Mail.Send)."""
from fastapi import APIRouter, Depends, HTTPException, status

from backend.config import settings
from backend.dependencies import get_current_user
from backend.models.user import User

router = APIRouter()


def _graph_configured() -> bool:
    """True si hay credenciales Azure AD y buzón de envío (permiso Mail.Send)."""
    return bool(
        settings.AZURE_AD_CLIENT_ID
        and settings.AZURE_AD_CLIENT_SECRET
        and settings.AZURE_AD_TENANT_ID
        and settings.SMTP_FROM
    )


@router.post("/send-report")
async def send_report(
    body: dict,
    user: User = Depends(get_current_user),
):
    """
    Envía al email del usuario logueado un correo con el resumen de cambios.
    Usa Microsoft Graph (Mail.Send) desde el buzón configurado (ej. administracion.compras@vimafoods.com).
    Body: { "language": "es"|"en", "subject": str, "htmlBody": str, "attachments": [{"filename", "contentBase64", "contentId"}] }
    """
    if not _graph_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El envío de correo no está configurado (Microsoft Graph / Mail.Send). Configure AZURE_AD_* y SMTP_FROM.",
        )
    to_email = user.email
    if not to_email or to_email == "dev@local":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede enviar el correo: usuario sin email válido.",
        )
    subject = body.get("subject") or "Resumen de comparación de etiquetas"
    html_body = body.get("htmlBody") or ""
    attachments = body.get("attachments") or []

    try:
        from backend.services.graph_mail import send_mail_via_graph

        send_mail_via_graph(
            from_user=settings.SMTP_FROM,
            to_email=to_email,
            subject=subject,
            html_body=html_body,
            attachments=attachments,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error al enviar el correo: {str(e)}",
        )
    return {"ok": True, "message": "Correo enviado correctamente."}
