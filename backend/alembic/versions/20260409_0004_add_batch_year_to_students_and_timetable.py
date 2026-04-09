"""add batch year to students and timetable

Revision ID: 20260409_0004
Revises: 20260409_0003
Create Date: 2026-04-09 01:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260409_0004"
down_revision = "20260409_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.add_column("students", sa.Column("batch_year", sa.Integer(), nullable=True))
  op.add_column("timetables", sa.Column("batch_year", sa.Integer(), nullable=True))

  connection = op.get_bind()
  connection.execute(sa.text("UPDATE students SET batch_year = EXTRACT(YEAR FROM created_at)"))
  connection.execute(sa.text("UPDATE timetables SET batch_year = EXTRACT(YEAR FROM CURRENT_DATE)"))

  op.alter_column("students", "batch_year", nullable=False)
  op.alter_column("timetables", "batch_year", nullable=False)
  op.create_index(op.f("ix_students_batch_year"), "students", ["batch_year"], unique=False)
  op.create_index(op.f("ix_timetables_batch_year"), "timetables", ["batch_year"], unique=False)

  op.drop_constraint("uq_timetable_slot", "timetables", type_="unique")
  op.create_unique_constraint(
      "uq_timetable_slot",
      "timetables",
      ["day", "department", "batch_year", "semester", "start_time", "end_time"],
  )


def downgrade() -> None:
  op.drop_constraint("uq_timetable_slot", "timetables", type_="unique")
  op.create_unique_constraint(
      "uq_timetable_slot",
      "timetables",
      ["day", "department", "semester", "start_time", "end_time"],
  )
  op.drop_index(op.f("ix_timetables_batch_year"), table_name="timetables")
  op.drop_index(op.f("ix_students_batch_year"), table_name="students")
  op.drop_column("timetables", "batch_year")
  op.drop_column("students", "batch_year")
