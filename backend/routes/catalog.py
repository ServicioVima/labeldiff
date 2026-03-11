"""CRUD Catálogo: listar, crear, editar, borrar (con subida a Blob y auditoría)."""
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import select

from backend.database import AsyncSessionLocal
from backend.models.user import User, Role
from backend.models.catalog import Catalog
from backend.models.audit import CatalogLog, CatalogLogAction
from backend.dependencies import get_current_user, require_role
from backend.services.blob_storage import upload_blob, get_sas_url, delete_blob

router = APIRouter()


class CatalogCreate(BaseModel):
    name: str
    version: Optional[str] = None
    client: Optional[str] = None
    metadata_json: Optional[str] = None
    instructions: Optional[str] = None


class CatalogUpdate(BaseModel):
    name: Optional[str] = None
    version: Optional[str] = None
    client: Optional[str] = None
    metadata_json: Optional[str] = None
    instructions: Optional[str] = None


class CatalogResponse(BaseModel):
    id: int
    name: str
    version: Optional[str]
    client: Optional[str]
    metadata_json: Optional[str]
    reference_blob_path: Optional[str]
    new_version_blob_path: Optional[str]
    instructions: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


def _catalog_to_dict(c: Catalog) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "version": c.version,
        "client": c.client,
        "metadata_json": c.metadata_json,
        "reference_blob_path": c.reference_blob_path,
        "new_version_blob_path": c.new_version_blob_path,
        "instructions": c.instructions,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }


@router.get("", response_model=list[CatalogResponse])
async def list_catalog(
    name: Optional[str] = Query(None),
    version: Optional[str] = Query(None),
    client: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
):
    """Lista entradas del catálogo con filtros opcionales."""
    from backend.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        q = select(Catalog).where(Catalog.deleted_at.is_(None))
        if name:
            q = q.where(Catalog.name.ilike(f"%{name}%"))
        if version:
            q = q.where(Catalog.version == version)
        if client:
            q = q.where(Catalog.client.ilike(f"%{client}%"))
        q = q.order_by(Catalog.updated_at.desc())
        result = await db.execute(q)
        items = result.scalars().all()
        return [CatalogResponse(**_catalog_to_dict(c)) for c in items]


@router.post("", response_model=CatalogResponse, status_code=status.HTTP_201_CREATED)
async def create_catalog(
    name: str = Form(...),
    version: Optional[str] = Form(None),
    client: Optional[str] = Form(None),
    metadata_json: Optional[str] = Form(None),
    instructions: Optional[str] = Form(None),
    reference_file: Optional[UploadFile] = File(None),
    new_version_file: Optional[UploadFile] = File(None),
    user: User = Depends(require_role(Role.admin, Role.user)),
):
    """Crea entrada: sube archivos a Blob, guarda en DB y registra en catalog_logs."""
    async with AsyncSessionLocal() as db:
        ref_path = None
        new_path = None
        if reference_file and reference_file.filename:
            data = await reference_file.read()
            ref_path = upload_blob(data, reference_file.content_type or "application/octet-stream", prefix="ref")
        if new_version_file and new_version_file.filename:
            data = await new_version_file.read()
            new_path = upload_blob(data, new_version_file.content_type or "application/octet-stream", prefix="new")
        catalog = Catalog(
            name=name,
            version=version,
            client=client,
            metadata_json=metadata_json,
            instructions=instructions,
            reference_blob_path=ref_path,
            new_version_blob_path=new_path,
            created_by_id=user.id,
        )
        db.add(catalog)
        await db.flush()
        await db.refresh(catalog)
        log = CatalogLog(
            user_id=user.id,
            catalog_id=catalog.id,
            action=CatalogLogAction.create,
            data_after=json.dumps(_catalog_to_dict(catalog)),
        )
        db.add(log)
        await db.commit()
        await db.refresh(catalog)
        return CatalogResponse(**_catalog_to_dict(catalog))


@router.put("/{catalog_id}", response_model=CatalogResponse)
async def update_catalog(
    catalog_id: int,
    body: CatalogUpdate,
    user: User = Depends(require_role(Role.admin, Role.user)),
):
    """Edita una entrada; registra datos anteriores y nuevos en catalog_logs."""
    if user.role == Role.viewer:
        raise HTTPException(status_code=403, detail="Sin permisos para editar")
    async with AsyncSessionLocal() as db:
        catalog = await db.get(Catalog, catalog_id)
        if not catalog or catalog.deleted_at:
            raise HTTPException(status_code=404, detail="No encontrado")
        data_before = json.dumps(_catalog_to_dict(catalog))
        if body.name is not None:
            catalog.name = body.name
        if body.version is not None:
            catalog.version = body.version
        if body.client is not None:
            catalog.client = body.client
        if body.metadata_json is not None:
            catalog.metadata_json = body.metadata_json
        if body.instructions is not None:
            catalog.instructions = body.instructions
        catalog.updated_at = datetime.utcnow()
        await db.flush()
        await db.refresh(catalog)
        log = CatalogLog(
            user_id=user.id,
            catalog_id=catalog.id,
            action=CatalogLogAction.update,
            data_before=data_before,
            data_after=json.dumps(_catalog_to_dict(catalog)),
        )
        db.add(log)
        await db.commit()
        await db.refresh(catalog)
        return CatalogResponse(**_catalog_to_dict(catalog))


@router.delete("/{catalog_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_catalog(
    catalog_id: int,
    user: User = Depends(require_role(Role.admin)),
):
    """Borrado lógico (deleted_at) y registro en catalog_logs. Solo admin."""
    async with AsyncSessionLocal() as db:
        catalog = await db.get(Catalog, catalog_id)
        if not catalog or catalog.deleted_at:
            raise HTTPException(status_code=404, detail="No encontrado")
        data_before = json.dumps(_catalog_to_dict(catalog))
        catalog.deleted_at = datetime.utcnow()
        log = CatalogLog(
            user_id=user.id,
            catalog_id=catalog.id,
            action=CatalogLogAction.delete,
            data_before=data_before,
        )
        db.add(log)
        await db.commit()


@router.get("/sas")
async def get_sas(
    blob_path: str = Query(..., description="Path del blob en el contenedor"),
    user: User = Depends(get_current_user),
):
    """Devuelve una URL con SAS temporal para visualizar el blob de forma segura."""
    url = get_sas_url(blob_path)
    return {"url": url}
