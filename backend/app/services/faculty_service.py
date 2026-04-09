from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.faculty import FacultyProfile
from app.models.user import User
from app.services import department_service


def generate_faculty_code(db: Session, department_name: str, department_code: str) -> str:
  year = datetime.now().year
  prefix = f"FAC-{department_code}-{year}-"
  existing_codes = (
      db.query(FacultyProfile.faculty_code)
      .filter(
          FacultyProfile.department == department_name,
          FacultyProfile.faculty_code.like(f"{prefix}%"),
      )
      .all()
  )
  max_sequence = 0
  for (value,) in existing_codes:
    suffix = value[len(prefix):]
    if suffix.isdigit():
      max_sequence = max(max_sequence, int(suffix))
  return f"{prefix}{max_sequence + 1:03d}"


def create_faculty_profile(db: Session, *, user: User, full_name: str, department: str) -> FacultyProfile:
  department_record = department_service.require_department(db, department)
  existing = db.query(FacultyProfile).filter(
      (FacultyProfile.user_id == user.id) | (FacultyProfile.email == user.email),
  ).first()
  if existing:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Faculty profile already exists for this account",
    )

  profile = FacultyProfile(
      user_id=user.id,
      faculty_code=generate_faculty_code(db, department_record.name, department_record.code),
      name=full_name,
      department=department_record.name,
      email=user.email,
  )
  db.add(profile)
  db.commit()
  db.refresh(profile)
  return profile


def get_faculty_profile_by_user_id(db: Session, user_id: int) -> FacultyProfile | None:
  return db.query(FacultyProfile).filter(FacultyProfile.user_id == user_id).first()
