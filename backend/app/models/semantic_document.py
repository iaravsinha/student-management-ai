import datetime
from sqlalchemy import String, Text, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector

from app.core.db import Base


class SemanticDocument(Base):
  __tablename__ = "semantic_documents"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  title: Mapped[str] = mapped_column(String(255), nullable=False)
  content: Mapped[str] = mapped_column(Text, nullable=False)
  document_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
  source_table: Mapped[str | None] = mapped_column(String(50), nullable=True)
  source_id: Mapped[int | None] = mapped_column(nullable=True)
  embedding: Mapped[list[float]] = mapped_column(Vector(1536), nullable=False)
  metadata_: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
  created_at: Mapped[datetime.datetime] = mapped_column(
      DateTime(timezone=True),
      default=datetime.datetime.utcnow,
      nullable=False,
  )
  updated_at: Mapped[datetime.datetime] = mapped_column(
      DateTime(timezone=True),
      default=datetime.datetime.utcnow,
      onupdate=datetime.datetime.utcnow,
      nullable=False,
  )
