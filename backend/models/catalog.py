from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class Catalog(Base):
    __tablename__ = "catalog"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[str] = mapped_column(String(64), nullable=True)
    client: Mapped[str] = mapped_column(String(255), nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    # Rutas en Blob (no URLs públicas)
    reference_blob_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    new_version_blob_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)  # Prompt/instrucciones para IA
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # Borrado lógico
