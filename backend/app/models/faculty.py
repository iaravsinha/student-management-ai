from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class FacultyProfile(Base):
  __tablename__ = "faculty_profiles"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
  faculty_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
  name: Mapped[str] = mapped_column(String(120), nullable=False)
  department: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
  email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
  created_at: Mapped[datetime] = mapped_column(
      DateTime(timezone=True),
      default=lambda: datetime.now(timezone.utc),
      nullable=False,
  )
