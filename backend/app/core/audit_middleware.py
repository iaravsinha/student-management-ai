from time import perf_counter

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.database import SessionLocal
from app.services.audit_service import log_action


class AuditLoggingMiddleware(BaseHTTPMiddleware):
  async def dispatch(self, request: Request, call_next):
    start = perf_counter()
    response = None
    try:
      response = await call_next(request)
      return response
    finally:
      should_log = request.method in {"POST", "PUT", "PATCH", "DELETE"}
      status_code = response.status_code if response else 500
      if status_code >= 400:
        should_log = True
      if should_log and not request.url.path.startswith("/health"):
        token_payload = getattr(request.state, "token_payload", None)
        db = SessionLocal()
        try:
          log_action(
              db,
              actor_email=getattr(token_payload, "sub", None),
              actor_role=getattr(token_payload, "role", None),
              action=f"http:{request.method.lower()}",
              entity_type=request.url.path.strip("/").split("/", 1)[0] or "root",
              entity_id=request.url.path,
              status="success" if status_code < 400 else "error",
              meta={
                  "method": request.method,
                  "path": request.url.path,
                  "status_code": status_code,
                  "duration_ms": round((perf_counter() - start) * 1000, 2),
              },
          )
        finally:
          db.close()
