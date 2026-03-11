from datetime import datetime
from sqlalchemy import String, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from backend.database import Base


class Role(str, enum.Enum):
    admin = "admin"
    user = "user"
    viewer = "viewer"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    role: Mapped[Role] = mapped_column(Enum(Role), nullable=False, default=Role.viewer)
    azure_oid: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)  # Entra ID object id
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
