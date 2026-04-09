import re

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.attendance import Attendance
from app.models.department import Department
from app.models.faculty import FacultyProfile
from app.models.result import ResultRecord
from app.models.student import Student
from app.models.subject import Subject
from app.models.timetable import Timetable
from app.models.user import User, UserRole
from app.schemas.department import DepartmentCreate, DepartmentSummary, DepartmentUpdate


def department_code_seed(name: str) -> str:
  tokens = re.findall(r"[A-Za-z0-9]+", name.upper())
  if not tokens:
    return "GEN"
  if len(tokens) == 1:
    return tokens[0][:6]
  return "".join(token[0] for token in tokens)[:6]


def _unique_code(db: Session, seed: str, exclude_department_id: int | None = None) -> str:
  index = 1
  while True:
    candidate = seed if index == 1 else f"{seed}{index}"
    query = db.query(Department).filter(Department.code == candidate)
    if exclude_department_id is not None:
      query = query.filter(Department.id != exclude_department_id)
    if not query.first():
      return candidate
    index += 1


def get_department_by_id(db: Session, department_id: int) -> Department:
  department = db.query(Department).filter(Department.id == department_id).first()
  if not department:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
  return department


def get_department_by_name(db: Session, name: str) -> Department | None:
  return db.query(Department).filter(func.lower(Department.name) == name.strip().lower()).first()


def get_department_by_code(db: Session, code: str) -> Department | None:
  return db.query(Department).filter(func.lower(Department.code) == code.strip().lower()).first()


def get_department_by_reference(db: Session, reference: str) -> Department | None:
  normalized = reference.strip()
  return get_department_by_name(db, normalized) or get_department_by_code(db, normalized)


def require_department(db: Session, reference: str) -> Department:
  department = get_department_by_reference(db, reference)
  if department:
    return department
  raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Selected department does not exist. Create it from the admin workspace first.",
  )


def ensure_department_catalog_entry(db: Session, name: str) -> Department:
  normalized_name = name.strip()
  existing = get_department_by_name(db, normalized_name)
  if existing:
    return existing

  seed = department_code_seed(normalized_name)
  department = Department(name=normalized_name, code=_unique_code(db, seed), is_active=True)
  db.add(department)
  db.commit()
  db.refresh(department)
  return department


def create_department(db: Session, payload: DepartmentCreate) -> Department:
  if get_department_by_name(db, payload.name):
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Department name already exists")
  code = _unique_code(db, payload.code.strip().upper())
  if payload.head_user_id is not None:
    head_user = db.query(User).filter(User.id == payload.head_user_id).first()
    if not head_user or head_user.role not in {UserRole.admin, UserRole.teacher}:
      raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department head must be an admin or teacher")

  department = Department(
      name=payload.name.strip(),
      code=code,
      head_user_id=payload.head_user_id,
      is_active=payload.is_active,
  )
  db.add(department)
  db.commit()
  db.refresh(department)
  return department


def update_department(db: Session, department_id: int, payload: DepartmentUpdate) -> Department:
  department = get_department_by_id(db, department_id)
  updates = payload.model_dump(exclude_unset=True)
  if not updates:
    return department

  if "name" in updates and updates["name"] is not None:
    existing = get_department_by_name(db, updates["name"])
    if existing and existing.id != department.id:
      raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Department name already exists")
    old_name = department.name
    new_name = updates["name"].strip()
    if old_name != new_name:
      db.query(Student).filter(Student.department == old_name).update({Student.department: new_name}, synchronize_session=False)
      db.query(FacultyProfile).filter(FacultyProfile.department == old_name).update({FacultyProfile.department: new_name}, synchronize_session=False)
      db.query(Subject).filter(Subject.department == old_name).update({Subject.department: new_name}, synchronize_session=False)
      db.query(Timetable).filter(Timetable.department == old_name).update({Timetable.department: new_name}, synchronize_session=False)
      department.name = new_name

  if "code" in updates and updates["code"] is not None:
    department.code = _unique_code(db, updates["code"].strip().upper(), exclude_department_id=department.id)

  if "head_user_id" in updates:
    head_user_id = updates["head_user_id"]
    if head_user_id is not None:
      head_user = db.query(User).filter(User.id == head_user_id).first()
      if not head_user or head_user.role not in {UserRole.admin, UserRole.teacher}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department head must be an admin or teacher")
    department.head_user_id = head_user_id

  if "is_active" in updates and updates["is_active"] is not None:
    department.is_active = updates["is_active"]

  db.add(department)
  db.commit()
  db.refresh(department)
  return department


def delete_department(db: Session, department_id: int) -> None:
  department = get_department_by_id(db, department_id)
  has_dependencies = any([
      db.query(Student.id).filter(Student.department == department.name).first(),
      db.query(FacultyProfile.id).filter(FacultyProfile.department == department.name).first(),
      db.query(Subject.id).filter(Subject.department == department.name).first(),
      db.query(Timetable.id).filter(Timetable.department == department.name).first(),
  ])
  if has_dependencies:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Department cannot be deleted while students, faculty, subjects, or timetable entries still reference it",
    )
  db.delete(department)
  db.commit()


def list_departments_with_summary(db: Session) -> list[DepartmentSummary]:
  departments = db.query(Department).order_by(Department.name.asc()).all()
  summaries: list[DepartmentSummary] = []
  for department in departments:
    student_count = db.query(func.count(Student.id)).filter(Student.department == department.name).scalar() or 0
    faculty_count = db.query(func.count(FacultyProfile.id)).filter(FacultyProfile.department == department.name).scalar() or 0
    subject_count = db.query(func.count(Subject.id)).filter(Subject.department == department.name).scalar() or 0
    timetable_slot_count = db.query(func.count(Timetable.id)).filter(Timetable.department == department.name).scalar() or 0
    attendance_record_count = (
        db.query(func.count(Attendance.id))
        .join(Student, Student.id == Attendance.student_id)
        .filter(Student.department == department.name)
        .scalar()
        or 0
    )
    result_record_count = (
        db.query(func.count(ResultRecord.id))
        .join(Student, Student.id == ResultRecord.student_id)
        .filter(Student.department == department.name)
        .scalar()
        or 0
    )
    batches = [
        value
        for (value,) in (
            db.query(Student.batch_year)
            .filter(Student.department == department.name)
            .distinct()
            .order_by(Student.batch_year.asc())
            .all()
        )
    ]
    semesters = [
        value
        for (value,) in (
            db.query(Student.semester)
            .filter(Student.department == department.name)
            .distinct()
            .order_by(Student.semester.asc())
            .all()
        )
    ]
    summaries.append(
        DepartmentSummary(
            id=department.id,
            name=department.name,
            code=department.code,
            head_user_id=department.head_user_id,
            is_active=department.is_active,
            created_at=department.created_at,
            faculty_count=faculty_count,
            student_count=student_count,
            subject_count=subject_count,
            timetable_slot_count=timetable_slot_count,
            attendance_record_count=attendance_record_count,
            result_record_count=result_record_count,
            active_batches=batches,
            active_semesters=semesters,
        )
    )
  return summaries
