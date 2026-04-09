from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.auth import require_roles
from app.core.db import get_db
from app.models.user import UserRole
from app.schemas.department import DepartmentCreate, DepartmentRead, DepartmentSummary, DepartmentUpdate
from app.services import department_service

router = APIRouter()


@router.get("/", response_model=list[DepartmentSummary])
def list_departments(
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.admin, UserRole.teacher, UserRole.student)),
):
  return department_service.list_departments_with_summary(db)


@router.post("/", response_model=DepartmentRead, status_code=status.HTTP_201_CREATED)
def create_department(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.admin)),
):
  return department_service.create_department(db, payload)


@router.put("/{department_id}", response_model=DepartmentRead)
def update_department(
    department_id: int,
    payload: DepartmentUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.admin)),
):
  return department_service.update_department(db, department_id, payload)


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(
    department_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.admin)),
) -> Response:
  department_service.delete_department(db, department_id)
  return Response(status_code=status.HTTP_204_NO_CONTENT)
