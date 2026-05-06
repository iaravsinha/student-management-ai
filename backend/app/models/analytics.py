from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class VisitorStats(Base):
    __tablename__ = "visitor_stats"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    total_visits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unique_visitors: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class VisitorClickLog(Base):
    __tablename__ = "visitor_click_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False, index=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    endpoint: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False, default="request")
    method: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    session_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    # actor_email taken from JWT token — avoids a DB round-trip per request
    actor_email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    # user_id FK is nullable; populated only when explicitly set (not from middleware)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # JSONB for flexible future analytics fields
    meta: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
