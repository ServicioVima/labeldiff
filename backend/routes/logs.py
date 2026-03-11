"""Historial de cambios: solo rol admin."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select

from backend.database import AsyncSessionLocal
from backend.models.user import User, Role
from backend.models.audit import UserLog, UserLogAction, CatalogLog, CatalogLogAction
from backend.dependencies import get_current_user, RequireAdmin

router = APIRouter()


class UserLogEntry(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    details: Optional[str]
    ip_address: Optional[str]
    created_at: datetime


class CatalogLogEntry(BaseModel):
    id: int
    user_id: Optional[int]
    catalog_id: Optional[int]
    action: str
    data_before: Optional[str]
    data_after: Optional[str]
    created_at: datetime


@router.get("/user", response_model=list[UserLogEntry])
async def list_user_logs(
    user: User = RequireAdmin,
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
):
    """Lista registros de user_logs (logins y actividad). Solo admin."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(UserLog).order_by(UserLog.created_at.desc()).limit(limit).offset(offset)
        )
        rows = result.scalars().all()
        return [
            UserLogEntry(
                id=r.id,
                user_id=r.user_id,
                action=r.action.value,
                details=r.details,
                ip_address=r.ip_address,
                created_at=r.created_at,
            )
            for r in rows
        ]


@router.get("/catalog", response_model=list[CatalogLogEntry])
async def list_catalog_logs(
    user: User = RequireAdmin,
    catalog_id: Optional[int] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
):
    """Lista registros de catalog_logs (CRUD). Solo admin."""
    async with AsyncSessionLocal() as db:
        q = select(CatalogLog).order_by(CatalogLog.created_at.desc()).limit(limit).offset(offset)
        if catalog_id is not None:
            q = q.where(CatalogLog.catalog_id == catalog_id)
        result = await db.execute(q)
        rows = result.scalars().all()
        return [
            CatalogLogEntry(
                id=r.id,
                user_id=r.user_id,
                catalog_id=r.catalog_id,
                action=r.action.value,
                data_before=r.data_before,
                data_after=r.data_after,
                created_at=r.created_at,
            )
            for r in rows
        ]
