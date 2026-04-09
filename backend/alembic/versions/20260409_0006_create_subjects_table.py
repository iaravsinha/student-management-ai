"""create subjects table

Revision ID: 20260409_0006
Revises: 20260409_0005
Create Date: 2026-04-09 07:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260409_0006"
down_revision = "20260409_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.create_table(
      "subjects",
      sa.Column("id", sa.Integer(), nullable=False),
      sa.Column("name", sa.String(length=120), nullable=False),
      sa.Column("code", sa.String(length=40), nullable=True),
      sa.Column("department", sa.String(length=100), nullable=False),
      sa.Column("batch_year", sa.Integer(), nullable=False),
      sa.Column("semester", sa.Integer(), nullable=False),
      sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
      sa.PrimaryKeyConstraint("id"),
      sa.UniqueConstraint("department", "batch_year", "semester", "name", name="uq_subject_catalog_entry"),
  )
  op.create_index(op.f("ix_subjects_id"), "subjects", ["id"], unique=False)
  op.create_index(op.f("ix_subjects_department"), "subjects", ["department"], unique=False)
  op.create_index(op.f("ix_subjects_batch_year"), "subjects", ["batch_year"], unique=False)
  op.create_index(op.f("ix_subjects_semester"), "subjects", ["semester"], unique=False)


def downgrade() -> None:
  op.drop_index(op.f("ix_subjects_semester"), table_name="subjects")
  op.drop_index(op.f("ix_subjects_batch_year"), table_name="subjects")
  op.drop_index(op.f("ix_subjects_department"), table_name="subjects")
  op.drop_index(op.f("ix_subjects_id"), table_name="subjects")
  op.drop_table("subjects")
