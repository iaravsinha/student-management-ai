from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ResultRecord(Base):
  __tablename__ = "results"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=False)
  subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), index=True, nullable=False)
  subject_name: Mapped[str] = mapped_column(String(120), nullable=False)
  assessment_name: Mapped[str] = mapped_column(String(120), nullable=False)
  exam_type: Mapped[str] = mapped_column(String(40), nullable=False)
  max_marks: Mapped[int] = mapped_column(Integer, nullable=False)
  marks_obtained: Mapped[int] = mapped_column(Integer, nullable=False)
  grade: Mapped[str] = mapped_column(String(8), nullable=False)
  remarks: Mapped[str | None] = mapped_column(String(255), nullable=True)
  created_at: Mapped[datetime] = mapped_column(
      DateTime(timezone=True),
      default=lambda: datetime.now(timezone.utc),
      nullable=False,
  )
