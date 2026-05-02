from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.permissions import Operation, require_permission
from app.models.user import User
from app.schemas.result import ResultRead
from app.services import result_service

router = APIRouter()


@router.get("/student/{student_id}", response_model=list[ResultRead])
def student_results(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Operation.RESULT_READ)),
):
  return result_service.list_results_for_student(db, current_user=current_user, student_id=student_id)
