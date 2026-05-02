"""create baseline academic schema

Revision ID: 20260408_0001
Revises:
Create Date: 2026-04-08 14:30:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260408_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
  user_role = postgresql.ENUM("admin", "teacher", "student", name="user_role", create_type=False)
  user_role.create(op.get_bind(), checkfirst=True)
  attendance_status = postgresql.ENUM("present", "absent", name="attendance_status", create_type=False)
  attendance_status.create(op.get_bind(), checkfirst=True)
  weekday_enum = postgresql.ENUM(
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
      name="weekday_enum",
      create_type=False,
  )
  weekday_enum.create(op.get_bind(), checkfirst=True)

  op.create_table(
      "users",
      sa.Column("id", sa.Integer(), nullable=False),
      sa.Column("email", sa.String(length=255), nullable=False),
      sa.Column("password_hash", sa.String(length=255), nullable=False),
      sa.Column("role", user_role, nullable=False),
      sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
      sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
      sa.PrimaryKeyConstraint("id"),
  )
  op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
  op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

  op.create_table(
      "departments",
      sa.Column("id", sa.Integer(), nullable=False),
      sa.Column("name", sa.String(length=100), nullable=False),
      sa.Column("code", sa.String(length=20), nullable=False),
      sa.Column("head_user_id", sa.Integer(), nullable=True),
      sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
      sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
      sa.ForeignKeyConstraint(["head_user_id"], ["users.id"], ondelete="SET NULL"),
      sa.PrimaryKeyConstraint("id"),
  )
  op.create_index(op.f("ix_departments_id"), "departments", ["id"], unique=False)
  op.create_index(op.f("ix_departments_name"), "departments", ["name"], unique=True)
  op.create_index(op.f("ix_departments_code"), "departments", ["code"], unique=True)
  op.create_index(op.f("ix_departments_head_user_id"), "departments", ["head_user_id"], unique=False)

  op.create_table(
      "students",
      sa.Column("id", sa.Integer(), nullable=False),
      sa.Column("name", sa.String(length=120), nullable=False),
      sa.Column("roll_number", sa.String(length=50), nullable=False),
      sa.Column("department", sa.String(length=100), nullable=False),
      sa.Column("semester", sa.Integer(), nullable=False),
      sa.Column("email", sa.String(length=255), nullable=False),
      sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
      sa.PrimaryKeyConstraint("id"),
  )
  op.create_index(op.f("ix_students_id"), "students", ["id"], unique=False)
  op.create_index(op.f("ix_students_roll_number"), "students", ["roll_number"], unique=True)
  op.create_index(op.f("ix_students_email"), "students", ["email"], unique=True)

  op.create_table(
      "attendance",
      sa.Column("id", sa.Integer(), nullable=False),
      sa.Column("student_id", sa.Integer(), nullable=False),
      sa.Column("subject_id", sa.Integer(), nullable=False),
      sa.Column("date", sa.Date(), nullable=False),
      sa.Column("status", attendance_status, nullable=False),
      sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
      sa.PrimaryKeyConstraint("id"),
      sa.UniqueConstraint("student_id", "subject_id", "date", name="uq_attendance_record"),
  )
  op.create_index(op.f("ix_attendance_id"), "attendance", ["id"], unique=False)
  op.create_index(op.f("ix_attendance_student_id"), "attendance", ["student_id"], unique=False)
  op.create_index(op.f("ix_attendance_subject_id"), "attendance", ["subject_id"], unique=False)
  op.create_index(op.f("ix_attendance_date"), "attendance", ["date"], unique=False)

  op.create_table(
      "timetables",
      sa.Column("id", sa.Integer(), nullable=False),
      sa.Column("day", weekday_enum, nullable=False),
      sa.Column("subject_id", sa.Integer(), nullable=False),
      sa.Column("start_time", sa.Time(), nullable=False),
      sa.Column("end_time", sa.Time(), nullable=False),
      sa.PrimaryKeyConstraint("id"),
      sa.UniqueConstraint("day", "subject_id", "start_time", "end_time", name="uq_timetable_slot"),
  )
  op.create_index(op.f("ix_timetables_id"), "timetables", ["id"], unique=False)
  op.create_index(op.f("ix_timetables_day"), "timetables", ["day"], unique=False)
  op.create_index(op.f("ix_timetables_subject_id"), "timetables", ["subject_id"], unique=False)

  op.create_table(
      "holidays",
      sa.Column("id", sa.Integer(), nullable=False),
      sa.Column("date", sa.Date(), nullable=False),
      sa.Column("description", sa.String(length=255), nullable=False),
      sa.PrimaryKeyConstraint("id"),
  )
  op.create_index(op.f("ix_holidays_id"), "holidays", ["id"], unique=False)
  op.create_index(op.f("ix_holidays_date"), "holidays", ["date"], unique=True)


def downgrade() -> None:
  op.drop_index(op.f("ix_holidays_date"), table_name="holidays")
  op.drop_index(op.f("ix_holidays_id"), table_name="holidays")
  op.drop_table("holidays")
  op.drop_index(op.f("ix_timetables_subject_id"), table_name="timetables")
  op.drop_index(op.f("ix_timetables_day"), table_name="timetables")
  op.drop_index(op.f("ix_timetables_id"), table_name="timetables")
  op.drop_table("timetables")
  op.drop_index(op.f("ix_attendance_date"), table_name="attendance")
  op.drop_index(op.f("ix_attendance_subject_id"), table_name="attendance")
  op.drop_index(op.f("ix_attendance_student_id"), table_name="attendance")
  op.drop_index(op.f("ix_attendance_id"), table_name="attendance")
  op.drop_table("attendance")
  op.drop_index(op.f("ix_students_email"), table_name="students")
  op.drop_index(op.f("ix_students_roll_number"), table_name="students")
  op.drop_index(op.f("ix_students_id"), table_name="students")
  op.drop_table("students")
  op.drop_index(op.f("ix_departments_head_user_id"), table_name="departments")
  op.drop_index(op.f("ix_departments_code"), table_name="departments")
  op.drop_index(op.f("ix_departments_name"), table_name="departments")
  op.drop_index(op.f("ix_departments_id"), table_name="departments")
  op.drop_table("departments")
  op.drop_index(op.f("ix_users_email"), table_name="users")
  op.drop_index(op.f("ix_users_id"), table_name="users")
  op.drop_table("users")
  sa.Enum(name="weekday_enum").drop(op.get_bind(), checkfirst=True)
  sa.Enum(name="attendance_status").drop(op.get_bind(), checkfirst=True)
  sa.Enum("admin", "teacher", "student", name="user_role").drop(
      op.get_bind(),
      checkfirst=True,
  )
