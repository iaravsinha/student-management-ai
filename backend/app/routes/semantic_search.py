from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_active_user
from app.core.db import get_db
from app.models.user import User, UserRole
from app.models.student import Student
from app.services.embedding_service import embedding_service

router = APIRouter()


class SemanticSearchRequest(BaseModel):
  query: str = Field(..., description="The query to search for semantically")
  top_k: int = Field(default=5, ge=1, le=20, description="Number of results to retrieve")
  filters: dict[str, Any] | None = Field(default=None, description="Optional metadata filters")


class SemanticSearchResultItem(BaseModel):
  id: int
  title: str
  content: str
  document_type: str
  similarity_score: float
  metadata: dict[str, Any]


@router.post(
    "/semantic-search",
    response_model=list[SemanticSearchResultItem],
    status_code=status.HTTP_200_OK,
)
async def semantic_search(
    payload: SemanticSearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
  """Performs an authorized vector semantic similarity search over institutional and academic data."""
  try:
    # 1. Enforce Role-Based Access Controls (RBAC) boundaries
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    filters = payload.filters or {}

    if current_user.role == UserRole.student:
      # Students can ONLY search general documents (FAQs, notices, policies)
      # or THEIR OWN student/academic profile.
      student = db.query(Student).filter(Student.email == current_user.email).first()
      if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile mapping missing for your authenticated user account.",
        )
      # Force filter constraints to prevent students from retrieving other students' logs
      filters["student_id"] = str(student.id)

    # 2. Generate embedding vector for the search query
    query_vector = await embedding_service.generate_embedding(payload.query)

    # 3. Perform similarity query
    results = embedding_service.similarity_search(
        db=db,
        query_embedding=query_vector,
        limit=payload.top_k,
        filters=filters,
        role_context=role_str,
    )

    # 4. Format outputs
    response_items = []
    for doc, score in results:
      response_items.append(
          SemanticSearchResultItem(
              id=doc.id,
              title=doc.title,
              content=doc.content,
              document_type=doc.document_type,
              similarity_score=score,
              metadata=doc.metadata_,
          )
      )

    return response_items

  except HTTPException:
    raise
  except Exception as e:
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"An unexpected error occurred during semantic search: {str(e)}",
    )
