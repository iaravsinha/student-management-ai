from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Department(Base):
  __tablename__ = "departments"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
  code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
  batch_start_year: Mapped[int] = mapped_column(Integer, nullable=False, default=2024)
  batch_end_year: Mapped[int] = mapped_column(Integer, nullable=False, default=2028)
  semester_count: Mapped[int] = mapped_column(Integer, nullable=False, default=8)
  head_user_id: Mapped[int | None] = mapped_column(
      ForeignKey("users.id", ondelete="SET NULL"),
      nullable=True,
      index=True,
  )
  is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
  created_at: Mapped[datetime] = mapped_column(
      DateTime(timezone=True),
      default=lambda: datetime.now(timezone.utc),
      nullable=False,
  )
