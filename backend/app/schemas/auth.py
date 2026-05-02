from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.config import settings
from app.models.user import UserRole


def validate_new_password(value: str) -> str:
  if len(value) < settings.MIN_PASSWORD_LENGTH:
    raise ValueError(f"Password must be at least {settings.MIN_PASSWORD_LENGTH} characters long")
  if not any(character.isalpha() for character in value):
    raise ValueError("Password must include at least one letter")
  if not any(character.isdigit() for character in value):
    raise ValueError("Password must include at least one number")
  return value


class RegisterRequest(BaseModel):
  email: EmailStr
  password: str = Field(min_length=8, max_length=128)
  role: UserRole = UserRole.student

  @field_validator("password")
  @classmethod
  def password_strength(cls, value: str) -> str:
    return validate_new_password(value)


class AdminCreateUserRequest(BaseModel):
  full_name: str | None = None
  email: EmailStr
  password: str = Field(min_length=8, max_length=128)
  role: UserRole = UserRole.student
  is_active: bool = True
  department: str | None = None
  batch_year: int | None = None
  semester: int | None = None

  @field_validator("password")
  @classmethod
  def password_strength(cls, value: str) -> str:
    return validate_new_password(value)


class BootstrapAdminRequest(BaseModel):
  email: EmailStr
  password: str = Field(min_length=8, max_length=128)

  @field_validator("password")
  @classmethod
  def password_strength(cls, value: str) -> str:
    return validate_new_password(value)


class LoginRequest(BaseModel):
  email: EmailStr
  password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
  access_token: str
  token_type: str = "bearer"


class UserResponse(BaseModel):
  id: int
  email: EmailStr
  role: UserRole
  is_active: bool
  created_at: datetime

  class Config:
    from_attributes = True
