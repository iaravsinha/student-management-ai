"""add department academic config

Revision ID: 20260409_0009
Revises: 20260409_0008
Create Date: 2026-04-09 18:25:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260409_0009"
down_revision = "20260409_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.add_column("departments", sa.Column("batch_start_year", sa.Integer(), nullable=False, server_default="2024"))
  op.add_column("departments", sa.Column("batch_end_year", sa.Integer(), nullable=False, server_default="2028"))
  op.add_column("departments", sa.Column("semester_count", sa.Integer(), nullable=False, server_default="8"))
  op.alter_column("departments", "batch_start_year", server_default=None)
  op.alter_column("departments", "batch_end_year", server_default=None)
  op.alter_column("departments", "semester_count", server_default=None)


def downgrade() -> None:
  op.drop_column("departments", "semester_count")
  op.drop_column("departments", "batch_end_year")
  op.drop_column("departments", "batch_start_year")
