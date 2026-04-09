from __future__ import annotations

import argparse

import app.models  # noqa: F401
from app.core.database import SessionLocal
from app.models.attendance import Attendance
from app.models.department import Department
from app.models.faculty import FacultyProfile
from app.models.result import ResultRecord
from app.models.student import Student
from app.models.subject import Subject
from app.models.timetable import Holiday, Timetable
from app.models.user import User, UserRole


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(description="Reset StudentMS data while preserving one admin account")
  parser.add_argument(
      "--keep-admin-email",
      default=None,
      help="Admin email to preserve. If omitted, the oldest admin account is kept.",
  )
  return parser.parse_args()


def get_admin_to_keep(db, keep_admin_email: str | None) -> User:
  if keep_admin_email:
    admin = (
        db.query(User)
        .filter(User.email == keep_admin_email, User.role == UserRole.admin)
        .first()
    )
    if not admin:
      raise ValueError(f"Admin account not found for email: {keep_admin_email}")
    return admin

  admin = (
      db.query(User)
      .filter(User.role == UserRole.admin)
      .order_by(User.created_at.asc(), User.id.asc())
      .first()
  )
  if not admin:
    raise ValueError("No admin account exists to preserve.")
  return admin


def main() -> None:
  args = parse_args()
  db = SessionLocal()
  try:
    admin_to_keep = get_admin_to_keep(db, args.keep_admin_email)

    db.query(Attendance).delete(synchronize_session=False)
    db.query(ResultRecord).delete(synchronize_session=False)
    db.query(Timetable).delete(synchronize_session=False)
    db.query(Holiday).delete(synchronize_session=False)
    db.query(Subject).delete(synchronize_session=False)
    db.query(Student).delete(synchronize_session=False)
    db.query(FacultyProfile).delete(synchronize_session=False)
    db.query(Department).delete(synchronize_session=False)
    db.query(User).filter(User.id != admin_to_keep.id).delete(synchronize_session=False)

    admin_to_keep.is_active = True
    db.add(admin_to_keep)
    db.commit()

    print("System data reset complete.")
    print(f"Preserved admin: {admin_to_keep.email}")
  finally:
    db.close()


if __name__ == "__main__":
  main()
