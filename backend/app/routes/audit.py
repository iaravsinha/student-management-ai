from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.permissions import Operation, require_permission
from app.models.user import User
from app.schemas.audit import AIActionLogRequest, AuditLogRead
from app.services import audit_service

router = APIRouter()


@router.get("", response_model=list[AuditLogRead])
def list_audit_logs(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _=Depends(require_permission(Operation.AUDIT_READ)),
):
  return audit_service.list_audit_logs(db, limit=limit)


@router.post("/ai-action", response_model=AuditLogRead, status_code=status.HTTP_201_CREATED)
def log_ai_action(
    payload: AIActionLogRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Operation.AI_ACTION_CREATE)),
):
  return audit_service.log_action(
      db,
      actor=current_user,
      action=f"ai:{payload.action}",
      entity_type="ai_action",
      status=payload.status,
      detail=payload.detail,
      meta={"command": payload.command, "result": payload.result},
  )
