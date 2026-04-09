"""add faculty profiles and expand timetable

Revision ID: 20260409_0003
Revises: 20260408_0002
Create Date: 2026-04-09 00:20:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260409_0003"
down_revision = "20260408_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.create_table(
      "faculty_profiles",
      sa.Column("id", sa.Integer(), nullable=False),
      sa.Column("user_id", sa.Integer(), nullable=False),
      sa.Column("faculty_code", sa.String(length=50), nullable=False),
      sa.Column("name", sa.String(length=120), nullable=False),
      sa.Column("department", sa.String(length=100), nullable=False),
      sa.Column("email", sa.String(length=255), nullable=False),
      sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
      sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
      sa.PrimaryKeyConstraint("id"),
  )
  op.create_index(op.f("ix_faculty_profiles_id"), "faculty_profiles", ["id"], unique=False)
  op.create_index(op.f("ix_faculty_profiles_user_id"), "faculty_profiles", ["user_id"], unique=True)
  op.create_index(op.f("ix_faculty_profiles_faculty_code"), "faculty_profiles", ["faculty_code"], unique=True)
  op.create_index(op.f("ix_faculty_profiles_department"), "faculty_profiles", ["department"], unique=False)
  op.create_index(op.f("ix_faculty_profiles_email"), "faculty_profiles", ["email"], unique=True)

  op.add_column("timetables", sa.Column("subject_name", sa.String(length=120), nullable=True))
  op.add_column("timetables", sa.Column("department", sa.String(length=100), nullable=True))
  op.add_column("timetables", sa.Column("semester", sa.Integer(), nullable=True))
  op.add_column("timetables", sa.Column("faculty_user_id", sa.Integer(), nullable=True))
  op.add_column("timetables", sa.Column("room", sa.String(length=50), nullable=True))
  op.drop_constraint("uq_timetable_slot", "timetables", type_="unique")
  op.create_foreign_key(
      "fk_timetables_faculty_user_id_users",
      "timetables",
      "users",
      ["faculty_user_id"],
      ["id"],
      ondelete="CASCADE",
  )

  connection = op.get_bind()
  connection.execute(sa.text("UPDATE timetables SET subject_name = CONCAT('Subject ', subject_id) WHERE subject_name IS NULL"))
  connection.execute(sa.text("UPDATE timetables SET department = 'GENERAL' WHERE department IS NULL"))
  connection.execute(sa.text("UPDATE timetables SET semester = 1 WHERE semester IS NULL"))

  op.alter_column("timetables", "subject_name", nullable=False)
  op.alter_column("timetables", "department", nullable=False)
  op.alter_column("timetables", "semester", nullable=False)
  op.create_index(op.f("ix_timetables_department"), "timetables", ["department"], unique=False)
  op.create_index(op.f("ix_timetables_semester"), "timetables", ["semester"], unique=False)
  op.create_index(op.f("ix_timetables_faculty_user_id"), "timetables", ["faculty_user_id"], unique=False)
  op.create_unique_constraint(
      "uq_timetable_slot",
      "timetables",
      ["day", "department", "semester", "start_time", "end_time"],
  )


def downgrade() -> None:
  op.drop_constraint("uq_timetable_slot", "timetables", type_="unique")
  op.drop_index(op.f("ix_timetables_faculty_user_id"), table_name="timetables")
  op.drop_index(op.f("ix_timetables_semester"), table_name="timetables")
  op.drop_index(op.f("ix_timetables_department"), table_name="timetables")
  op.drop_constraint("fk_timetables_faculty_user_id_users", "timetables", type_="foreignkey")
  op.drop_column("timetables", "room")
  op.drop_column("timetables", "faculty_user_id")
  op.drop_column("timetables", "semester")
  op.drop_column("timetables", "department")
  op.drop_column("timetables", "subject_name")
  op.create_unique_constraint(
      "uq_timetable_slot",
      "timetables",
      ["day", "subject_id", "start_time", "end_time"],
  )

  op.drop_index(op.f("ix_faculty_profiles_email"), table_name="faculty_profiles")
  op.drop_index(op.f("ix_faculty_profiles_department"), table_name="faculty_profiles")
  op.drop_index(op.f("ix_faculty_profiles_faculty_code"), table_name="faculty_profiles")
  op.drop_index(op.f("ix_faculty_profiles_user_id"), table_name="faculty_profiles")
  op.drop_index(op.f("ix_faculty_profiles_id"), table_name="faculty_profiles")
  op.drop_table("faculty_profiles")
