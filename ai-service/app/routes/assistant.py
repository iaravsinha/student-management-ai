from fastapi import APIRouter

from app.schemas.assistant import AssistantQuery, AssistantResponse
from app.services.rag import get_rag_chain

router = APIRouter()


@router.post("/query", response_model=AssistantResponse)
async def query_assistant(payload: AssistantQuery) -> AssistantResponse:
  chain = get_rag_chain()
  answer = await chain.ainvoke({"question": payload.question, "context": payload.context})
  return AssistantResponse(answer=str(answer))

