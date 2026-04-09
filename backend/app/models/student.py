from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Student(Base):
  __tablename__ = "students"
  __table_args__ = (
      UniqueConstraint("department", "roll_number", name="uq_students_department_roll_number"),
  )

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  enrollment_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
  name: Mapped[str] = mapped_column(String(120), nullable=False)
  roll_number: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
  department: Mapped[str] = mapped_column(String(100), nullable=False)
  batch_year: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
  semester: Mapped[int] = mapped_column(Integer, nullable=False)
  email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
  created_at: Mapped[datetime] = mapped_column(
      DateTime(timezone=True),
      default=lambda: datetime.now(timezone.utc),
      nullable=False,
  )

