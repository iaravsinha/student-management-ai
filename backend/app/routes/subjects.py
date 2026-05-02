from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.permissions import Operation, require_permission
from app.schemas.subject import SubjectCreate, SubjectRead, SubjectUpdate
from app.services import subject_service

router = APIRouter()


@router.get("/", response_model=list[SubjectRead])
def list_subjects(
    department: str | None = Query(default=None),
    batch_year: int | None = Query(default=None, ge=2000, le=2100),
    semester: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
    _=Depends(require_permission(Operation.SUBJECT_READ)),
):
  return subject_service.list_subjects(
      db,
      department=department,
      batch_year=batch_year,
      semester=semester,
  )


@router.post("/", response_model=SubjectRead, status_code=status.HTTP_201_CREATED)
def create_subject(
    payload: SubjectCreate,
    db: Session = Depends(get_db),
    _=Depends(require_permission(Operation.SUBJECT_MANAGE)),
):
  return subject_service.create_subject(db, payload)


@router.put("/{subject_id}", response_model=SubjectRead)
def update_subject(
    subject_id: int,
    payload: SubjectUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_permission(Operation.SUBJECT_MANAGE)),
):
  return subject_service.update_subject(db, subject_id, payload)


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_permission(Operation.SUBJECT_MANAGE)),
) -> Response:
  subject_service.delete_subject(db, subject_id)
  return Response(status_code=status.HTTP_204_NO_CONTENT)
