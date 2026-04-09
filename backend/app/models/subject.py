from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Subject(Base):
  __tablename__ = "subjects"
  __table_args__ = (
      UniqueConstraint(
          "department",
          "batch_year",
          "semester",
          "name",
          name="uq_subject_catalog_entry",
      ),
  )

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  name: Mapped[str] = mapped_column(String(120), nullable=False)
  code: Mapped[str | None] = mapped_column(String(40), nullable=True)
  department: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
  batch_year: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
  semester: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
  created_at: Mapped[datetime] = mapped_column(
      DateTime(timezone=True),
      default=lambda: datetime.now(timezone.utc),
      nullable=False,
  )
