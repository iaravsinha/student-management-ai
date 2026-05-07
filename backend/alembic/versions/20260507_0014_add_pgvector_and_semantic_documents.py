"""add pgvector and semantic documents

Revision ID: 20260507_0014
Revises: 20260507_0013
Create Date: 2026-05-07 01:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from pgvector.sqlalchemy import Vector

revision = "20260507_0014"
down_revision = "20260507_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
  # 1. Enable pgvector extension
  op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

  # 2. Create semantic_documents table
  op.create_table(
      "semantic_documents",
      sa.Column("id", sa.Integer(), nullable=False),
      sa.Column("title", sa.String(length=255), nullable=False),
      sa.Column("content", sa.Text(), nullable=False),
      sa.Column("document_type", sa.String(length=50), nullable=False),
      sa.Column("source_table", sa.String(length=50), nullable=True),
      sa.Column("source_id", sa.Integer(), nullable=True),
      sa.Column("embedding", Vector(1536), nullable=False),
      sa.Column("metadata", JSONB(), nullable=False),
      sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
      sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
      sa.PrimaryKeyConstraint("id"),
  )

  # 3. Create indexes
  op.create_index(op.f("ix_semantic_documents_id"), "semantic_documents", ["id"], unique=False)
  op.create_index(op.f("ix_semantic_documents_document_type"), "semantic_documents", ["document_type"], unique=False)

  # 4. Create HNSW index for high performance vector cosine distance search
  op.execute(
      "CREATE INDEX ix_semantic_documents_embedding ON semantic_documents "
      "USING hnsw (embedding vector_cosine_ops);"
  )


def downgrade() -> None:
  op.execute("DROP INDEX IF EXISTS ix_semantic_documents_embedding;")
  op.drop_index(op.f("ix_semantic_documents_document_type"), table_name="semantic_documents")
  op.drop_index(op.f("ix_semantic_documents_id"), table_name="semantic_documents")
  op.drop_table("semantic_documents")
  op.execute("DROP EXTENSION IF EXISTS vector;")
