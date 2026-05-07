from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.permissions import Operation, require_permission
from app.schemas.analytics import (
    ClickLogListResponse,
    TopIPItem,
    TopRouteItem,
    VisitorStatsRead,
)
from app.services import analytics_service

router = APIRouter()


@router.get("/visitors", response_model=VisitorStatsRead)
def get_visitor_stats(
    db: Session = Depends(get_db),
    _=Depends(require_permission(Operation.ANALYTICS_READ)),
):
    """Aggregate visitor statistics: totals, unique IPs, and period breakdowns."""
    return analytics_service.get_visitor_stats(db)


@router.get("/clicks", response_model=ClickLogListResponse)
def list_click_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    ip_address: str | None = Query(default=None, description="Filter by exact IP address"),
    start_date: datetime | None = Query(default=None, description="ISO-8601 lower bound"),
    end_date: datetime | None = Query(default=None, description="ISO-8601 upper bound"),
    endpoint: str | None = Query(default=None, description="Substring match on endpoint path"),
    method: str | None = Query(default=None, description="HTTP method (GET, POST, …)"),
    db: Session = Depends(get_db),
    _=Depends(require_permission(Operation.ANALYTICS_READ)),
):
    """Paginated, filterable click/request log."""
    items, total = analytics_service.list_click_logs(
        db,
        page=page,
        page_size=page_size,
        ip_address=ip_address,
        start_date=start_date,
        end_date=end_date,
        endpoint=endpoint,
        method=method,
    )
    return ClickLogListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/top-routes", response_model=list[TopRouteItem])
def get_top_routes(
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    _=Depends(require_permission(Operation.ANALYTICS_READ)),
):
    """Most frequently accessed endpoints, ranked by request count."""
    return analytics_service.get_top_routes(db, limit=limit)


@router.get("/top-ips", response_model=list[TopIPItem])
def get_top_ips(
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    _=Depends(require_permission(Operation.ANALYTICS_READ)),
):
    """Most active IP addresses, ranked by request count."""
    return analytics_service.get_top_ips(db, limit=limit)
