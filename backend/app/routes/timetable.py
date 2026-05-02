from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.permissions import Operation, require_permission
from app.models.timetable import WeekDay
from app.models.user import User
from app.schemas.timetable import (
    HolidayCreate,
    HolidayRead,
    TimetableCreate,
    TimetableRead,
    WeeklyTimetableUpsertRequest,
)
from app.services import timetable_service

router = APIRouter()


@router.post("/", response_model=TimetableRead)
def create_timetable(
    payload: TimetableCreate,
    db: Session = Depends(get_db),
    _=Depends(require_permission(Operation.TIMETABLE_MANAGE)),
):
  return timetable_service.create_timetable_entry(db, payload)


@router.get("/", response_model=list[TimetableRead])
def list_timetable(
    department: str | None = None,
    batch_year: int | None = None,
    semester: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Operation.TIMETABLE_READ)),
):
  return timetable_service.list_timetable_for_user_with_filters(
      db,
      current_user,
      department=department,
      batch_year=batch_year,
      semester=semester,
  )


@router.put("/weekly", response_model=list[TimetableRead])
def replace_weekly_timetable(
    payload: WeeklyTimetableUpsertRequest,
    db: Session = Depends(get_db),
    _=Depends(require_permission(Operation.TIMETABLE_MANAGE)),
):
  return timetable_service.replace_weekly_timetable(db, payload)


@router.get("/day/{day}", response_model=list[TimetableRead])
def timetable_by_day(
    day: WeekDay,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Operation.TIMETABLE_READ)),
):
  return timetable_service.list_timetable_for_user_by_day(db, current_user, day)


@router.post("/holidays", response_model=HolidayRead)
def create_holiday(
    payload: HolidayCreate,
    db: Session = Depends(get_db),
    _=Depends(require_permission(Operation.HOLIDAY_MANAGE)),
):
  return timetable_service.create_holiday(db, payload)


@router.get("/holidays", response_model=list[HolidayRead])
def list_holidays(
    db: Session = Depends(get_db),
    _=Depends(require_permission(Operation.TIMETABLE_READ)),
):
  return timetable_service.list_holidays(db)

