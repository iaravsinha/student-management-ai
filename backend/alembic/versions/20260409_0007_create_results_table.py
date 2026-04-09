"""create results table

Revision ID: 20260409_0007
Revises: 20260409_0006
Create Date: 2026-04-09 02:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260409_0007"
down_revision = "20260409_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.create_table(
      "results",
      sa.Column("id", sa.Integer(), nullable=False),
      sa.Column("student_id", sa.Integer(), nullable=False),
      sa.Column("subject_id", sa.Integer(), nullable=False),
      sa.Column("subject_name", sa.String(length=120), nullable=False),
      sa.Column("assessment_name", sa.String(length=120), nullable=False),
      sa.Column("exam_type", sa.String(length=40), nullable=False),
      sa.Column("max_marks", sa.Integer(), nullable=False),
      sa.Column("marks_obtained", sa.Integer(), nullable=False),
      sa.Column("grade", sa.String(length=8), nullable=False),
      sa.Column("remarks", sa.String(length=255), nullable=True),
      sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
      sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
      sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
      sa.PrimaryKeyConstraint("id"),
  )
  op.create_index(op.f("ix_results_id"), "results", ["id"], unique=False)
  op.create_index(op.f("ix_results_student_id"), "results", ["student_id"], unique=False)
  op.create_index(op.f("ix_results_subject_id"), "results", ["subject_id"], unique=False)


def downgrade() -> None:
  op.drop_index(op.f("ix_results_subject_id"), table_name="results")
  op.drop_index(op.f("ix_results_student_id"), table_name="results")
  op.drop_index(op.f("ix_results_id"), table_name="results")
  op.drop_table("results")
