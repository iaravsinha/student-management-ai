from fastapi import APIRouter, Depends
from datetime import date
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.permissions import Operation, require_permission
from app.models.user import User
from app.schemas.attendance import (
    AttendanceBulkMarkRequest,
    AttendanceMarkRequest,
    AttendancePercentageResponse,
    AttendanceRead,
)
from app.services import attendance_service

router = APIRouter()


@router.post("/mark", response_model=AttendanceRead)
def mark_attendance(
    payload: AttendanceMarkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Operation.ATTENDANCE_MARK)),
):
  return attendance_service.mark_attendance(db, payload, current_user=current_user)


@router.post("/mark-bulk", response_model=list[AttendanceRead])
def mark_bulk_attendance(
    payload: AttendanceBulkMarkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Operation.ATTENDANCE_MARK)),
):
  return attendance_service.mark_bulk_attendance_for_class(db, payload, current_user=current_user)


@router.get("/class/{timetable_id}", response_model=list[AttendanceRead])
def class_attendance_for_date(
    timetable_id: int,
    attendance_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Operation.ATTENDANCE_MARK)),
):
  return attendance_service.get_class_attendance_for_date(
      db,
      timetable_id=timetable_id,
      attendance_date=attendance_date,
      current_user=current_user,
  )


@router.get("/student/{student_id}", response_model=list[AttendanceRead])
def student_attendance_history(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Operation.ATTENDANCE_READ)),
):
  attendance_service.ensure_attendance_access(db, current_user, student_id)
  return attendance_service.get_attendance_history(db, student_id)


@router.get(
    "/percentage/{student_id}/{subject_id}",
    response_model=AttendancePercentageResponse,
)
def attendance_percentage(
    student_id: int,
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Operation.ATTENDANCE_READ)),
):
  attendance_service.ensure_attendance_access(db, current_user, student_id)
  total_classes, attended_classes, percentage = (
      attendance_service.calculate_attendance_percentage(db, student_id, subject_id)
  )
  return AttendancePercentageResponse(
      student_id=student_id,
      subject_id=subject_id,
      total_classes=total_classes,
      attended_classes=attended_classes,
      attendance_percentage=percentage,
  )

