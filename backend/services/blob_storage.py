"""Servicio Azure Blob Storage: subida de archivos y generación de SAS temporales."""
import uuid
from datetime import datetime, timedelta
from typing import BinaryIO

from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
from azure.core.exceptions import ResourceNotFoundError

from backend.config import settings


def _get_account_key():
    """Extrae AccountKey de la connection string."""
    for part in settings.AZURE_STORAGE_CONNECTION_STRING.split(";"):
        if part.strip().lower().startswith("accountkey="):
            return part.split("=", 1)[1].strip()
    return None


def _get_client():
    if not settings.AZURE_STORAGE_CONNECTION_STRING:
        raise ValueError("AZURE_STORAGE_CONNECTION_STRING no configurado")
    return BlobServiceClient.from_connection_string(settings.AZURE_STORAGE_CONNECTION_STRING)


def _container_client():
    return _get_client().get_container_client(settings.AZURE_STORAGE_CONTAINER)


def upload_blob(
    data: bytes | BinaryIO,
    content_type: str,
    prefix: str = "labels",
) -> str:
    """Sube bytes o stream al contenedor. Retorna el path del blob (no URL pública)."""
    ext = ""
    if content_type == "application/pdf":
        ext = ".pdf"
    elif content_type.startswith("image/"):
        ext = ".png" if "png" in content_type else ".jpg"
    else:
        ext = ".bin"
    blob_name = f"{prefix}/{uuid.uuid4().hex}{ext}"
    client = _container_client().get_blob_client(blob_name)
    client.upload_blob(data, overwrite=True, content_settings={"content_type": content_type})
    return blob_name


def get_sas_url(blob_path: str, expiry_minutes: int | None = None) -> str:
    """Genera URL con SAS temporal para que el frontend pueda visualizar el blob sin hacerlo público."""
    if not blob_path:
        return ""
    expiry = expiry_minutes or settings.SAS_EXPIRY_MINUTES
    client = _container_client()
    blob_client = client.get_blob_client(blob_path)
    account_key = _get_account_key()
    if not account_key:
        return blob_client.url
    sas_token = generate_blob_sas(
        account_name=blob_client.account_name,
        container_name=settings.AZURE_STORAGE_CONTAINER,
        blob_name=blob_path,
        account_key=account_key,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.utcnow() + timedelta(minutes=expiry),
    )
    return f"{blob_client.url}?{sas_token}"


def delete_blob(blob_path: str) -> bool:
    try:
        _container_client().get_blob_client(blob_path).delete_blob()
        return True
    except ResourceNotFoundError:
        return False
