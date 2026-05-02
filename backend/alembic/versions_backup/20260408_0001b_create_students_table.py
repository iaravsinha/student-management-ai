"""create students table

Revision ID: 20260408_0001b
Revises: 20260408_0001
Create Date: 2026-04-08
"""

from alembic import op
import sqlalchemy as sa

revision = "20260408_0001b"
down_revision = "20260408_0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "students",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("roll_number", sa.String(length=50), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_table("students")