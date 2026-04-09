from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class RegisterRequest(BaseModel):
  email: EmailStr
  password: str
  role: UserRole = UserRole.student


class AdminCreateUserRequest(BaseModel):
  full_name: str | None = None
  email: EmailStr
  password: str
  role: UserRole = UserRole.student
  is_active: bool = True
  department: str | None = None
  batch_year: int | None = None
  semester: int | None = None


class BootstrapAdminRequest(BaseModel):
  email: EmailStr
  password: str


class LoginRequest(BaseModel):
  email: EmailStr
  password: str


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
