from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.security import decode_access_token


class TokenValidationMiddleware(BaseHTTPMiddleware):
  async def dispatch(self, request: Request, call_next):
    request.state.token_payload = None

    authorization = request.headers.get("Authorization")
    if authorization and authorization.lower().startswith("bearer "):
      token = authorization.split(" ", 1)[1].strip()
      if token:
        try:
          request.state.token_payload = decode_access_token(token)
        except Exception:  # noqa: BLE001
          request.state.token_payload = None

    return await call_next(request)

