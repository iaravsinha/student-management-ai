import pytest
from pydantic import ValidationError

from app.models.user import UserRole
from app.schemas.auth import AdminCreateUserRequest


def test_admin_create_user_requires_strong_password() -> None:
  with pytest.raises(ValidationError):
    AdminCreateUserRequest(
        email="student@example.com",
        password="password",
        role=UserRole.student,
        full_name="Test Student",
        department="CSE",
        batch_year=2026,
        semester=1,
    )


def test_admin_create_user_accepts_strong_password() -> None:
  payload = AdminCreateUserRequest(
      email="student@example.com",
      password="Password123",
      role=UserRole.student,
      full_name="Test Student",
      department="CSE",
      batch_year=2026,
      semester=1,
  )

  assert payload.email == "student@example.com"
