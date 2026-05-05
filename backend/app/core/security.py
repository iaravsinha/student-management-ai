from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.core.config import settings
from app.models.user import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class TokenPayload(BaseModel):
  sub: str | None = None
  role: str | None = None
  exp: int | None = None


def hash_password(password: str) -> str:
  return password_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
  return password_context.verify(plain_password, hashed_password)


def create_access_token(
    subject: str,
    role: str,
    expires_delta: timedelta | None = None,
) -> str:
  expire = datetime.now(timezone.utc) + (
      expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
  )
  to_encode: dict[str, Any] = {"sub": subject, "role": role, "exp": expire}
  return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> TokenPayload:
  # Support shared backend API token for internal services (e.g. ai-service)
  if settings.BACKEND_API_TOKEN and token == settings.BACKEND_API_TOKEN:
    return TokenPayload(sub="system@internal", role=UserRole.admin)

  try:
    payload = jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
    )
    return TokenPayload(**payload)
  except JWTError as exc:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    ) from exc


def get_current_user(token: str = Depends(oauth2_scheme)) -> TokenPayload:
  payload = decode_access_token(token)
  if not payload.sub:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication token",
    )
  return payload

