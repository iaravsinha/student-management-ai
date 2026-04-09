"""make student roll number department scoped

Revision ID: 20260409_0008
Revises: 20260409_0007
Create Date: 2026-04-09 18:05:00
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "20260409_0008"
down_revision = "20260409_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.drop_index("ix_students_roll_number", table_name="students")
  op.create_index("ix_students_roll_number", "students", ["roll_number"], unique=False)
  op.create_unique_constraint(
      "uq_students_department_roll_number",
      "students",
      ["department", "roll_number"],
  )


def downgrade() -> None:
  op.drop_constraint("uq_students_department_roll_number", "students", type_="unique")
  op.drop_index("ix_students_roll_number", table_name="students")
  op.create_index("ix_students_roll_number", "students", ["roll_number"], unique=True)
