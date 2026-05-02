from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.permissions import Operation, require_permission
from app.models.user import User
from app.schemas.overview import AcademicOverviewResponse
from app.services import overview_service

router = APIRouter()


@router.get("/academic", response_model=AcademicOverviewResponse)
def academic_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Operation.OVERVIEW_READ)),
):
  return overview_service.build_academic_overview(db, current_user)
