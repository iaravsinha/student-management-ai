"""add subject syllabus

Revision ID: 20260503_0011
Revises: 20260502_0010
Create Date: 2026-05-03 15:20:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260503_0011"
down_revision = "20260502_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.add_column("subjects", sa.Column("syllabus", sa.Text(), nullable=True))


def downgrade() -> None:
  op.drop_column("subjects", "syllabus")
