from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_active_user
from app.core.db import get_db
from app.core.permissions import Operation, require_permission
from app.models.user import User
from app.models.user import UserRole
from app.schemas.student import (
    StudentImportSummary,
    StudentCreate,
    StudentListResponse,
    StudentRead,
    StudentUpdate,
)
from app.services import student_service

router = APIRouter()


@router.post("/", response_model=StudentRead, status_code=status.HTTP_201_CREATED)
def create_student(
    payload: StudentCreate,
    db: Session = Depends(get_db),
    _=Depends(require_permission(Operation.STUDENT_CREATE)),
):
  return student_service.create_student(db, payload)


@router.post("/import", response_model=StudentImportSummary)
async def import_students(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Operation.STUDENT_IMPORT)),
):
  return await student_service.import_students_from_excel(db, file, current_user=current_user)


@router.get("", response_model=StudentListResponse)
def list_students(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    enrollment_number: str | None = Query(default=None),
    department: str | None = Query(default=None),
    batch_year: int | None = Query(default=None, ge=2000, le=2100),
    roll_number: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Operation.STUDENT_READ)),
):
  items, total = student_service.list_students(
      db,
      current_user=current_user,
      page=page,
      page_size=page_size,
      enrollment_number=enrollment_number,
      department=department,
      batch_year=batch_year,
      roll_number=roll_number,
  )
  return StudentListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/me", response_model=StudentRead)
def get_my_student_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
  if current_user.role != UserRole.student:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not available")
  return student_service.get_student_by_user_email(db, current_user.email)


@router.get("/class/{timetable_id}", response_model=list[StudentRead])
def list_students_for_class(
    timetable_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Operation.ATTENDANCE_MARK)),
):
  return student_service.list_students_for_timetable(db, current_user=current_user, timetable_id=timetable_id)


@router.get("/{student_id}", response_model=StudentRead)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Operation.STUDENT_READ)),
):
  return student_service.ensure_student_access(db, current_user, student_id)


@router.put("/{student_id}", response_model=StudentRead)
def update_student(
    student_id: int,
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_permission(Operation.STUDENT_UPDATE)),
):
  return student_service.update_student(db, student_id, payload)


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_permission(Operation.STUDENT_DELETE)),
) -> Response:
  student_service.delete_student(db, student_id)
  return Response(status_code=status.HTTP_204_NO_CONTENT)

