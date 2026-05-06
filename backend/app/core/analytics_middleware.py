import asyncio
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.database import SessionLocal
from app.services import analytics_service

logger = logging.getLogger("backend")

# Paths that carry no meaningful analytics signal and would produce noise
_SKIP_PREFIXES = (
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/analytics",  # prevent recursive self-logging
)

# Paths where query strings might carry tokens/credentials — drop them from meta
_SENSITIVE_PREFIXES = ("/auth/login", "/auth/register", "/auth/")


def _extract_ip(request: Request) -> str:
    """Return the real client IP, handling common proxy headers.

    X-Forwarded-For is trusted here; tighten this to a trusted-proxy allow-list
    if the deployment sits behind an untrusted reverse proxy.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Leftmost entry is the original client when proxies append correctly.
        ip = forwarded_for.split(",")[0].strip()
    else:
        ip = request.headers.get("X-Real-IP") or (
            request.client.host if request.client else "unknown"
        )

    # Normalise loopback variants to a single value for consistent grouping.
    if ip in ("::1", "::ffff:127.0.0.1", "0:0:0:0:0:0:0:1"):
        ip = "127.0.0.1"

    return ip[:45]  # column is VARCHAR(45) — max IPv6 representation length


def _should_skip(path: str) -> bool:
    return any(path.startswith(p) for p in _SKIP_PREFIXES)


def _log_sync(
    ip_address: str,
    user_agent: str | None,
    endpoint: str,
    method: str,
    status_code: int,
    session_id: str | None,
    actor_email: str | None,
    meta: dict,
) -> None:
    """Synchronous DB write — always called inside a thread-pool executor."""
    db = SessionLocal()
    try:
        analytics_service.log_visit(
            db,
            ip_address=ip_address,
            endpoint=endpoint,
            method=method,
            user_agent=user_agent,
            status_code=status_code,
            session_id=session_id,
            actor_email=actor_email,
            meta=meta,
        )
    except Exception:
        logger.exception("Analytics logging error (non-fatal)")
    finally:
        db.close()


class AnalyticsMiddleware(BaseHTTPMiddleware):
    """Logs every meaningful HTTP request to visitor_click_logs and increments
    visitor_stats.  DB writes happen in a background thread so they never add
    latency to the response path."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        path = request.url.path
        if _should_skip(path):
            return response

        ip = _extract_ip(request)
        user_agent = (request.headers.get("User-Agent") or "")[:512]
        method = request.method
        status_code = response.status_code
        token_payload = getattr(request.state, "token_payload", None)
        actor_email: str | None = getattr(token_payload, "sub", None)
        session_id: str | None = (
            request.cookies.get("session_id")
            or request.headers.get("X-Session-ID")
        )

        is_sensitive = any(path.startswith(p) for p in _SENSITIVE_PREFIXES)
        meta: dict = {
            "status_code": status_code,
            "query_params": None if is_sensitive else (str(request.query_params) or None),
        }

        # Fire-and-forget: schedule DB write in the default thread-pool executor.
        # The coroutine wrapper lets asyncio track the task lifetime properly.
        async def _bg() -> None:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None,
                _log_sync,
                ip, user_agent, path, method, status_code, session_id, actor_email, meta,
            )

        asyncio.create_task(_bg())

        return response
