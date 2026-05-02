"""add audit logs and subject foreign keys

Revision ID: 20260502_0010
Revises: 20260409_0009
Create Date: 2026-05-02 21:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260502_0010"
down_revision = "20260409_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.create_table(
      "audit_logs",
      sa.Column("id", sa.Integer(), nullable=False),
      sa.Column("actor_user_id", sa.Integer(), nullable=True),
      sa.Column("actor_email", sa.String(length=255), nullable=True),
      sa.Column("actor_role", sa.String(length=50), nullable=True),
      sa.Column("action", sa.String(length=120), nullable=False),
      sa.Column("entity_type", sa.String(length=120), nullable=True),
      sa.Column("entity_id", sa.String(length=120), nullable=True),
      sa.Column("status", sa.String(length=40), nullable=False),
      sa.Column("detail", sa.Text(), nullable=True),
      sa.Column("meta", sa.JSON(), nullable=True),
      sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
      sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
      sa.PrimaryKeyConstraint("id"),
  )
  op.create_index(op.f("ix_audit_logs_id"), "audit_logs", ["id"], unique=False)
  op.create_index(op.f("ix_audit_logs_actor_user_id"), "audit_logs", ["actor_user_id"], unique=False)
  op.create_index(op.f("ix_audit_logs_actor_email"), "audit_logs", ["actor_email"], unique=False)
  op.create_index(op.f("ix_audit_logs_actor_role"), "audit_logs", ["actor_role"], unique=False)
  op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"], unique=False)
  op.create_index(op.f("ix_audit_logs_entity_type"), "audit_logs", ["entity_type"], unique=False)
  op.create_index(op.f("ix_audit_logs_entity_id"), "audit_logs", ["entity_id"], unique=False)
  op.create_index(op.f("ix_audit_logs_status"), "audit_logs", ["status"], unique=False)
  op.create_index(op.f("ix_audit_logs_created_at"), "audit_logs", ["created_at"], unique=False)

  bind = op.get_bind()
  if bind.dialect.name == "postgresql":
    op.execute(
        "ALTER TABLE attendance ADD CONSTRAINT fk_attendance_subject_id_subjects "
        "FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE NOT VALID",
    )
    op.execute(
        "ALTER TABLE timetables ADD CONSTRAINT fk_timetables_subject_id_subjects "
        "FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE NOT VALID",
    )
  else:
    op.create_foreign_key(
        "fk_attendance_subject_id_subjects",
        "attendance",
        "subjects",
        ["subject_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_timetables_subject_id_subjects",
        "timetables",
        "subjects",
        ["subject_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
  op.drop_constraint("fk_timetables_subject_id_subjects", "timetables", type_="foreignkey")
  op.drop_constraint("fk_attendance_subject_id_subjects", "attendance", type_="foreignkey")
  op.drop_index(op.f("ix_audit_logs_created_at"), table_name="audit_logs")
  op.drop_index(op.f("ix_audit_logs_status"), table_name="audit_logs")
  op.drop_index(op.f("ix_audit_logs_entity_id"), table_name="audit_logs")
  op.drop_index(op.f("ix_audit_logs_entity_type"), table_name="audit_logs")
  op.drop_index(op.f("ix_audit_logs_action"), table_name="audit_logs")
  op.drop_index(op.f("ix_audit_logs_actor_role"), table_name="audit_logs")
  op.drop_index(op.f("ix_audit_logs_actor_email"), table_name="audit_logs")
  op.drop_index(op.f("ix_audit_logs_actor_user_id"), table_name="audit_logs")
  op.drop_index(op.f("ix_audit_logs_id"), table_name="audit_logs")
  op.drop_table("audit_logs")
