from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.permissions import Operation, require_permission
from app.models.faculty import FacultyProfile
from app.schemas.faculty import FacultyProfileRead

router = APIRouter()


@router.get("", response_model=list[FacultyProfileRead])
def list_faculty(
    db: Session = Depends(get_db),
    _=Depends(require_permission(Operation.FACULTY_READ)),
):
  return db.query(FacultyProfile).order_by(FacultyProfile.department, FacultyProfile.name).all()
