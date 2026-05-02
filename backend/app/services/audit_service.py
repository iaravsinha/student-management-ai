from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.models.user import User


def log_action(
    db: Session,
    *,
    action: str,
    actor: User | None = None,
    actor_email: str | None = None,
    actor_role: str | None = None,
    entity_type: str | None = None,
    entity_id: str | int | None = None,
    status: str = "success",
    detail: str | None = None,
    meta: dict | None = None,
) -> AuditLog:
  record = AuditLog(
      actor_user_id=actor.id if actor else None,
      actor_email=actor.email if actor else actor_email,
      actor_role=actor.role.value if actor else actor_role,
      action=action,
      entity_type=entity_type,
      entity_id=str(entity_id) if entity_id is not None else None,
      status=status,
      detail=detail,
      meta=meta,
  )
  db.add(record)
  db.commit()
  db.refresh(record)
  return record


def list_audit_logs(db: Session, *, limit: int = 100) -> list[AuditLog]:
  return db.query(AuditLog).order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(limit).all()
