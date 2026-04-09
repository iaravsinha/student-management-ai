"""add late attendance status

Revision ID: 20260409_0005
Revises: 20260409_0004
Create Date: 2026-04-09 05:40:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260409_0005"
down_revision = "20260409_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
  bind = op.get_bind()
  if bind.dialect.name == "postgresql":
    bind.execute(sa.text("ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'late'"))


def downgrade() -> None:
  # PostgreSQL enum values are intentionally left in place on downgrade.
  pass
