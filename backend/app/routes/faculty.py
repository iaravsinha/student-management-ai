from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import require_roles
from app.core.db import get_db
from app.models.faculty import FacultyProfile
from app.models.user import UserRole
from app.schemas.faculty import FacultyProfileRead

router = APIRouter()


@router.get("/", response_model=list[FacultyProfileRead])
def list_faculty(
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.admin, UserRole.teacher)),
):
  return db.query(FacultyProfile).order_by(FacultyProfile.department, FacultyProfile.name).all()
