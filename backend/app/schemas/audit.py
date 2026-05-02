from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AuditLogRead(BaseModel):
  model_config = ConfigDict(from_attributes=True)

  id: int
  actor_user_id: int | None = None
  actor_email: str | None = None
  actor_role: str | None = None
  action: str
  entity_type: str | None = None
  entity_id: str | None = None
  status: str
  detail: str | None = None
  meta: dict | None = None
  created_at: datetime


class AIActionLogRequest(BaseModel):
  action: str = Field(min_length=2, max_length=120)
  status: str = Field(default="success", max_length=40)
  detail: str | None = Field(default=None, max_length=2000)
  command: dict | None = None
  result: dict | None = None
