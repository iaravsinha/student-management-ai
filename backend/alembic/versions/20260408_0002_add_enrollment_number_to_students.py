"""add enrollment number to students

Revision ID: 20260408_0002
Revises: 20260408_0001
Create Date: 2026-04-08 23:40:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260408_0002"
down_revision = "20260408_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.add_column("students", sa.Column("enrollment_number", sa.String(length=50), nullable=True))

  connection = op.get_bind()
  rows = connection.execute(sa.text("SELECT id, roll_number FROM students ORDER BY id")).fetchall()
  for row in rows:
    enrollment_number = row.roll_number or f"ENR2026{row.id:05d}"
    connection.execute(
        sa.text(
            "UPDATE students SET enrollment_number = :enrollment_number WHERE id = :id",
        ),
        {"enrollment_number": enrollment_number, "id": row.id},
    )

  op.alter_column("students", "enrollment_number", nullable=False)
  op.create_index(op.f("ix_students_enrollment_number"), "students", ["enrollment_number"], unique=True)


def downgrade() -> None:
  op.drop_index(op.f("ix_students_enrollment_number"), table_name="students")
  op.drop_column("students", "enrollment_number")
