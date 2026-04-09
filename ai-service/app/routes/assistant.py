from fastapi import APIRouter, Header, HTTPException
import httpx

from app.chains.query_chain import run_query_chain
from app.schemas.assistant import AssistantQuery, AssistantResponse

router = APIRouter()


@router.post("/query", response_model=AssistantResponse)
async def query_assistant(
    payload: AssistantQuery,
    authorization: str | None = Header(default=None),
) -> AssistantResponse:
  try:
    answer, metadata = await run_query_chain(
        payload.student_id,
        payload.query,
        auth_header=authorization,
    )
    return AssistantResponse(answer=answer, metadata=metadata)
  except httpx.HTTPStatusError as exc:
    raise HTTPException(
        status_code=exc.response.status_code,
        detail=f"Backend data fetch failed: {exc.response.text}",
    ) from exc
  except httpx.RequestError as exc:
    raise HTTPException(
        status_code=503,
        detail=f"Backend service unavailable: {exc}",
    ) from exc

