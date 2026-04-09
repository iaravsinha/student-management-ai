"""create users table

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


def downgrade() -> None:
  op.drop_index(op.f("ix_users_email"), table_name="users")
  op.drop_index(op.f("ix_users_id"), table_name="users")
  op.drop_table("users")
  sa.Enum("admin", "teacher", "student", name="user_role").drop(
      op.get_bind(),
      checkfirst=True,
  )
