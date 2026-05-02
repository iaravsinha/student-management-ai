from datetime import date, time
from enum import Enum

from sqlalchemy import Date, Enum as SqlEnum, ForeignKey, Integer, String, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class WeekDay(str, Enum):
  monday = "monday"
  tuesday = "tuesday"
  wednesday = "wednesday"
  thursday = "thursday"
  friday = "friday"
  saturday = "saturday"
  sunday = "sunday"


class Timetable(Base):
  __tablename__ = "timetables"
  __table_args__ = (
      UniqueConstraint(
          "day",
          "department",
          "semester",
          "start_time",
          "end_time",
          name="uq_timetable_slot",
      ),
  )

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  day: Mapped[WeekDay] = mapped_column(SqlEnum(WeekDay, name="weekday_enum"), index=True)
  subject_id: Mapped[int] = mapped_column(
      ForeignKey("subjects.id", ondelete="CASCADE"),
      index=True,
      nullable=False,
  )
  subject_name: Mapped[str] = mapped_column(String(120), nullable=False)
  department: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
  batch_year: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
  semester: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
  faculty_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True)
  room: Mapped[str | None] = mapped_column(String(50), nullable=True)
  start_time: Mapped[time] = mapped_column(Time, nullable=False)
  end_time: Mapped[time] = mapped_column(Time, nullable=False)


class Holiday(Base):
  __tablename__ = "holidays"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  date: Mapped[date] = mapped_column(Date, unique=True, index=True, nullable=False)
  description: Mapped[str] = mapped_column(String(255), nullable=False)

