"""add attendance remarks

Revision ID: 20260503_0012
Revises: 20260503_0011
Create Date: 2026-05-03 21:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260503_0012"
down_revision = "20260503_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.add_column("attendance", sa.Column("remarks", sa.String(length=255), nullable=True))


def downgrade() -> None:
  op.drop_column("attendance", "remarks")
