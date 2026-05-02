from fastapi import APIRouter, Depends, Header, HTTPException
import httpx

from app.chains.query_chain import run_query_chain
from app.core.config import settings
from app.core.rate_limit import InMemoryRateLimiter
from app.schemas.assistant import AssistantQuery, AssistantResponse

router = APIRouter()
ai_rate_limiter = InMemoryRateLimiter(
    max_requests=settings.AI_RATE_LIMIT_COUNT,
    window_seconds=settings.AI_RATE_LIMIT_WINDOW_SECONDS,
    key_prefix="ai-query",
)


@router.post("/query", response_model=AssistantResponse, dependencies=[Depends(ai_rate_limiter)])
async def query_assistant(
    payload: AssistantQuery,
    authorization: str | None = Header(default=None),
) -> AssistantResponse:
  try:
    answer, command, metadata = await run_query_chain(
        payload.student_id,
        payload.query,
        auth_header=authorization,
        timetable_id=payload.timetable_id,
        attendance_date=payload.date,
        execute=payload.execute,
        conversation_history=[item.model_dump() for item in payload.conversation_history],
    )
    return AssistantResponse(answer=answer, command=command, metadata=metadata)
  except httpx.HTTPStatusError as exc:
    raise HTTPException(
        status_code=exc.response.status_code,
        detail=f"Upstream request failed: {exc.response.text}",
    ) from exc
  except httpx.RequestError as exc:
    raise HTTPException(
        status_code=503,
        detail=f"Upstream service unavailable: {exc}",
    ) from exc

