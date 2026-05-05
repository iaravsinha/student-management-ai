from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.auth import get_current_active_user
from app.core.permissions import Operation, require_permission
from app.models.faculty import FacultyProfile
from app.models.user import User, UserRole
from app.schemas.faculty import FacultyProfileRead
from app.services import faculty_service

router = APIRouter()


@router.get("/me", response_model=FacultyProfileRead)
def get_my_faculty_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
  if current_user.role != UserRole.teacher:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty profile not available")
  profile = faculty_service.get_faculty_profile_by_user_id(db, current_user.id)
  if not profile:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faculty profile not found")
  return profile


@router.get("", response_model=list[FacultyProfileRead])
def list_faculty(
    db: Session = Depends(get_db),
    _=Depends(require_permission(Operation.FACULTY_READ)),
):
  return db.query(FacultyProfile).order_by(FacultyProfile.department, FacultyProfile.name).all()
