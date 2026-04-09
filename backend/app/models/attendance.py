from datetime import date
from enum import Enum

from sqlalchemy import Date, Enum as SqlEnum, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class AttendanceStatus(str, Enum):
  present = "present"
  absent = "absent"
  late = "late"


class Attendance(Base):
  __tablename__ = "attendance"
  __table_args__ = (
      UniqueConstraint("student_id", "subject_id", "date", name="uq_attendance_record"),
  )

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  student_id: Mapped[int] = mapped_column(
      ForeignKey("students.id", ondelete="CASCADE"),
      index=True,
      nullable=False,
  )
  subject_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
  date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
  status: Mapped[AttendanceStatus] = mapped_column(
      SqlEnum(AttendanceStatus, name="attendance_status"),
      nullable=False,
  )

