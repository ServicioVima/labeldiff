from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column
import enum

from backend.database import Base


class UserLogAction(str, enum.Enum):
    login = "login"
    logout = "logout"
    activity = "activity"


class CatalogLogAction(str, enum.Enum):
    create = "create"
    update = "update"
    delete = "delete"


class UserLog(Base):
    __tablename__ = "user_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[UserLogAction] = mapped_column(Enum(UserLogAction), nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class CatalogLog(Base):
    __tablename__ = "catalog_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    catalog_id: Mapped[int | None] = mapped_column(ForeignKey("catalog.id"), nullable=True)
    action: Mapped[CatalogLogAction] = mapped_column(Enum(CatalogLogAction), nullable=False)
    data_before: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    data_after: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
