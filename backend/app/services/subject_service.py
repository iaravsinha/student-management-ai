from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.subject import Subject
from app.schemas.subject import SubjectCreate, SubjectUpdate
from app.services import department_service


def list_subjects(
    db: Session,
    *,
    department: str | None = None,
    batch_year: int | None = None,
    semester: int | None = None,
) -> list[Subject]:
  query = db.query(Subject)
  if department:
    query = query.filter(Subject.department == department)
  if batch_year is not None:
    query = query.filter(Subject.batch_year == batch_year)
  if semester is not None:
    query = query.filter(Subject.semester == semester)
  return query.order_by(Subject.name.asc(), Subject.id.asc()).all()


def get_subject_by_id(db: Session, subject_id: int) -> Subject:
  subject = db.query(Subject).filter(Subject.id == subject_id).first()
  if not subject:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Subject not found",
    )
  return subject


def _ensure_unique_subject(
    db: Session,
    *,
    name: str,
    department: str,
    batch_year: int,
    semester: int,
    exclude_subject_id: int | None = None,
) -> None:
  query = db.query(Subject).filter(
      Subject.name == name,
      Subject.department == department,
      Subject.batch_year == batch_year,
      Subject.semester == semester,
  )
  if exclude_subject_id is not None:
    query = query.filter(Subject.id != exclude_subject_id)
  if query.first():
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="A subject with this name already exists for the selected batch and semester",
    )


def create_subject(db: Session, payload: SubjectCreate) -> Subject:
  department = department_service.require_department(db, payload.department)
  _ensure_unique_subject(
      db,
      name=payload.name,
      department=department.name,
      batch_year=payload.batch_year,
      semester=payload.semester,
  )
  subject_data = payload.model_dump()
  subject_data["department"] = department.name
  subject = Subject(**subject_data)
  db.add(subject)
  db.commit()
  db.refresh(subject)
  return subject


def update_subject(db: Session, subject_id: int, payload: SubjectUpdate) -> Subject:
  subject = get_subject_by_id(db, subject_id)
  updates = payload.model_dump(exclude_unset=True)
  if not updates:
    return subject

  next_name = updates.get("name", subject.name)
  next_department = updates.get("department", subject.department)
  next_batch_year = updates.get("batch_year", subject.batch_year)
  next_semester = updates.get("semester", subject.semester)
  next_department_record = department_service.require_department(db, next_department)
  _ensure_unique_subject(
      db,
      name=next_name,
      department=next_department_record.name,
      batch_year=next_batch_year,
      semester=next_semester,
      exclude_subject_id=subject.id,
  )

  if "department" in updates:
    updates["department"] = next_department_record.name

  for key, value in updates.items():
    setattr(subject, key, value)

  db.add(subject)
  db.commit()
  db.refresh(subject)
  return subject


def delete_subject(db: Session, subject_id: int) -> None:
  subject = get_subject_by_id(db, subject_id)
  db.delete(subject)
  db.commit()
