from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import decode_access_token, oauth2_scheme
from app.models.user import User, UserRole


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
  payload = decode_access_token(token)
  if not payload.sub:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication token",
    )

  user = db.query(User).filter(User.email == payload.sub).first()
  if not user:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="User not found",
    )
  return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
  if not current_user.is_active:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Inactive user",
    )
  return current_user


def require_roles(*allowed_roles: UserRole) -> Callable:
  def role_dependency(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.role not in allowed_roles:
      raise HTTPException(
          status_code=status.HTTP_403_FORBIDDEN,
          detail="Insufficient permissions",
      )
    return current_user

  return role_dependency

