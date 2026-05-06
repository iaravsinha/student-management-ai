from datetime import datetime, timedelta, timezone

from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session

from app.models.analytics import VisitorClickLog, VisitorStats


def log_visit(
    db: Session,
    *,
    ip_address: str,
    endpoint: str,
    method: str,
    user_agent: str | None = None,
    status_code: int | None = None,
    session_id: str | None = None,
    actor_email: str | None = None,
    meta: dict | None = None,
) -> None:
    # Determine if this IP has been seen before (for unique visitor count).
    # Race conditions are acceptable here — minor over-counting is not critical.
    is_new_ip = not db.scalar(
        select(exists().where(VisitorClickLog.ip_address == ip_address))
    )

    db.add(
        VisitorClickLog(
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint=endpoint,
            action_type="request",
            method=method,
            status_code=status_code,
            session_id=session_id,
            actor_email=actor_email,
            meta=meta,
        )
    )

    # Maintain a single-row stats record (id=1) via upsert-style logic.
    stats = db.get(VisitorStats, 1)
    if stats is None:
        db.add(
            VisitorStats(
                id=1,
                total_visits=1,
                unique_visitors=1 if is_new_ip else 0,
            )
        )
    else:
        stats.total_visits += 1
        if is_new_ip:
            stats.unique_visitors += 1
        stats.updated_at = datetime.now(timezone.utc)

    db.commit()


def get_visitor_stats(db: Session) -> dict:
    stats = db.get(VisitorStats, 1)
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)

    today_visits = db.scalar(
        select(func.count(VisitorClickLog.id)).where(VisitorClickLog.timestamp >= today_start)
    ) or 0
    week_visits = db.scalar(
        select(func.count(VisitorClickLog.id)).where(VisitorClickLog.timestamp >= week_start)
    ) or 0
    month_visits = db.scalar(
        select(func.count(VisitorClickLog.id)).where(VisitorClickLog.timestamp >= month_start)
    ) or 0

    return {
        "id": 1,
        "total_visits": stats.total_visits if stats else 0,
        "unique_visitors": stats.unique_visitors if stats else 0,
        "today_visits": today_visits,
        "week_visits": week_visits,
        "month_visits": month_visits,
        "updated_at": stats.updated_at if stats else now,
    }


def list_click_logs(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 50,
    ip_address: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    endpoint: str | None = None,
    method: str | None = None,
) -> tuple[list[VisitorClickLog], int]:
    base_q = select(VisitorClickLog)

    if ip_address:
        base_q = base_q.where(VisitorClickLog.ip_address == ip_address)
    if start_date:
        base_q = base_q.where(VisitorClickLog.timestamp >= start_date)
    if end_date:
        base_q = base_q.where(VisitorClickLog.timestamp <= end_date)
    if endpoint:
        base_q = base_q.where(VisitorClickLog.endpoint.ilike(f"%{endpoint}%"))
    if method:
        base_q = base_q.where(VisitorClickLog.method == method.upper())

    total = db.scalar(select(func.count()).select_from(base_q.subquery())) or 0
    items = list(
        db.scalars(
            base_q
            .order_by(VisitorClickLog.timestamp.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return items, total


def get_top_routes(db: Session, *, limit: int = 10) -> list[dict]:
    rows = db.execute(
        select(VisitorClickLog.endpoint, func.count(VisitorClickLog.id).label("count"))
        .group_by(VisitorClickLog.endpoint)
        .order_by(func.count(VisitorClickLog.id).desc())
        .limit(limit)
    ).all()
    return [{"endpoint": row.endpoint, "count": row.count} for row in rows]


def get_top_ips(db: Session, *, limit: int = 10) -> list[dict]:
    rows = db.execute(
        select(VisitorClickLog.ip_address, func.count(VisitorClickLog.id).label("count"))
        .group_by(VisitorClickLog.ip_address)
        .order_by(func.count(VisitorClickLog.id).desc())
        .limit(limit)
    ).all()
    return [{"ip_address": row.ip_address, "count": row.count} for row in rows]
