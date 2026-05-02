from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class AuditLog(Base):
  __tablename__ = "audit_logs"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  actor_user_id: Mapped[int | None] = mapped_column(
      ForeignKey("users.id", ondelete="SET NULL"),
      nullable=True,
      index=True,
  )
  actor_email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
  actor_role: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
  action: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
  entity_type: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
  entity_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
  status: Mapped[str] = mapped_column(String(40), nullable=False, default="success", index=True)
  detail: Mapped[str | None] = mapped_column(Text, nullable=True)
  meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)
  created_at: Mapped[datetime] = mapped_column(
      DateTime(timezone=True),
      default=lambda: datetime.now(timezone.utc),
      nullable=False,
      index=True,
  )
