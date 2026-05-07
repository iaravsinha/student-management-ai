from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_active_user
from app.core.db import get_db
from app.models.user import User, UserRole
from app.models.semantic_document import SemanticDocument
from app.services.indexing_service import indexing_service

router = APIRouter()


class ReindexStatusResponse(BaseModel):
  status: str
  message: str


class VectorStatsResponse(BaseModel):
  total_documents: int
  by_type: dict[str, int]


async def run_reindexing_task(db_session: Session) -> None:
  """Background worker function to safely run indexing without locking thread."""
  try:
    logger_name = "backend.routes.admin_embedding"
    import logging
    logger = logging.getLogger(logger_name)
    logger.info("Starting global semantic reindexing background task...")
    stats = await indexing_service.reindex_all(db_session)
    logger.info(f"Global semantic reindexing completed successfully: {stats}")
  except Exception as e:
    import logging
    logger = logging.getLogger("backend.routes.admin_embedding")
    logger.error(f"Global reindexing background task failed: {e}")


@router.post(
    "/reindex",
    response_model=ReindexStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def trigger_reindex(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
  """Triggers asynchronous rebuild of all vector embeddings across the database. Restricted to Admin role."""
  if current_user.role != UserRole.admin:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied. Admin privileges required.",
    )

  background_tasks.add_task(run_reindexing_task, db)

  return ReindexStatusResponse(
      status="accepted",
      message="Global semantic re-indexing task has been dispatched. Vector storage is rebuilding in the background.",
  )


@router.get(
    "/vector-stats",
    response_model=VectorStatsResponse,
    status_code=status.HTTP_200_OK,
)
def get_vector_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
  """Returns vector statistics, including document counts grouped by category. Restricted to Admin role."""
  if current_user.role != UserRole.admin:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied. Admin privileges required.",
    )

  # Calculate total counts
  total = db.query(SemanticDocument).count()

  # Group and count by type
  grouped = (
      db.query(SemanticDocument.document_type, func.count(SemanticDocument.id))
      .group_by(SemanticDocument.document_type)
      .all()
  )

  stats_by_type = {doc_type: count for doc_type, count in grouped}

  return VectorStatsResponse(total_documents=total, by_type=stats_by_type)
