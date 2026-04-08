from pydantic import BaseModel


class AssistantQuery(BaseModel):
  question: str
  context: str | None = None


class AssistantResponse(BaseModel):
  answer: str

