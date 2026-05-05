from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Any

from app.core.database import get_db
from app.models.user import User, UserRole
from app.core.auth import get_current_user

router = APIRouter()

from pydantic import BaseModel

class SQLQuery(BaseModel):
    query: str

@router.post("/sql")
async def execute_sql(
    payload: SQLQuery,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> list[dict[str, Any]]:
    query = payload.query
    # Restrict to SELECT queries for safety
    if not query.strip().upper().startswith("SELECT"):
        raise HTTPException(status_code=400, detail="Only SELECT queries are allowed.")

    try:
        result = db.execute(text(query))
        # Convert to list of dicts
        return [dict(row._mapping) for row in result]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Query execution failed: {str(e)}")
