"""add visitor analytics tables

Revision ID: 20260507_0013
Revises: 20260503_0012
Create Date: 2026-05-07 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260507_0013"
down_revision = "20260503_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # --- visitor_stats ---------------------------------------------------
    op.create_table(
        "visitor_stats",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("total_visits", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unique_visitors", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_visitor_stats_id"), "visitor_stats", ["id"], unique=False)

    # --- visitor_click_logs ----------------------------------------------
    if is_pg:
        from sqlalchemy.dialects.postgresql import JSONB
        meta_col = sa.Column("meta", JSONB(), nullable=True)
    else:
        meta_col = sa.Column("meta", sa.JSON(), nullable=True)

    op.create_table(
        "visitor_click_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ip_address", sa.String(length=45), nullable=False),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("endpoint", sa.String(length=512), nullable=False),
        sa.Column("action_type", sa.String(length=50), nullable=False),
        sa.Column("method", sa.String(length=10), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("session_id", sa.String(length=128), nullable=True),
        sa.Column("actor_email", sa.String(length=255), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        meta_col,
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_visitor_click_logs_id"), "visitor_click_logs", ["id"], unique=False)
    op.create_index(op.f("ix_visitor_click_logs_ip_address"), "visitor_click_logs", ["ip_address"], unique=False)
    op.create_index(op.f("ix_visitor_click_logs_endpoint"), "visitor_click_logs", ["endpoint"], unique=False)
    op.create_index(op.f("ix_visitor_click_logs_method"), "visitor_click_logs", ["method"], unique=False)
    op.create_index(op.f("ix_visitor_click_logs_timestamp"), "visitor_click_logs", ["timestamp"], unique=False)
    op.create_index(op.f("ix_visitor_click_logs_session_id"), "visitor_click_logs", ["session_id"], unique=False)
    op.create_index(op.f("ix_visitor_click_logs_actor_email"), "visitor_click_logs", ["actor_email"], unique=False)
    op.create_index(op.f("ix_visitor_click_logs_user_id"), "visitor_click_logs", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_visitor_click_logs_user_id"), table_name="visitor_click_logs")
    op.drop_index(op.f("ix_visitor_click_logs_actor_email"), table_name="visitor_click_logs")
    op.drop_index(op.f("ix_visitor_click_logs_session_id"), table_name="visitor_click_logs")
    op.drop_index(op.f("ix_visitor_click_logs_timestamp"), table_name="visitor_click_logs")
    op.drop_index(op.f("ix_visitor_click_logs_method"), table_name="visitor_click_logs")
    op.drop_index(op.f("ix_visitor_click_logs_endpoint"), table_name="visitor_click_logs")
    op.drop_index(op.f("ix_visitor_click_logs_ip_address"), table_name="visitor_click_logs")
    op.drop_index(op.f("ix_visitor_click_logs_id"), table_name="visitor_click_logs")
    op.drop_table("visitor_click_logs")
    op.drop_index(op.f("ix_visitor_stats_id"), table_name="visitor_stats")
    op.drop_table("visitor_stats")
