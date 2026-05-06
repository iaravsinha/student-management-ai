from datetime import datetime

from pydantic import BaseModel, ConfigDict


class VisitorStatsRead(BaseModel):
    id: int
    total_visits: int
    unique_visitors: int
    today_visits: int
    week_visits: int
    month_visits: int
    updated_at: datetime


class ClickLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ip_address: str
    user_agent: str | None
    endpoint: str
    action_type: str
    method: str
    status_code: int | None
    session_id: str | None
    actor_email: str | None
    user_id: int | None
    meta: dict | None
    timestamp: datetime


class ClickLogListResponse(BaseModel):
    items: list[ClickLogRead]
    total: int
    page: int
    page_size: int


class TopRouteItem(BaseModel):
    endpoint: str
    count: int


class TopIPItem(BaseModel):
    ip_address: str
    count: int
