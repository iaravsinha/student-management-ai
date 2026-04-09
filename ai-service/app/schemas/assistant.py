from pydantic import BaseModel


class AssistantQuery(BaseModel):
  student_id: int
  query: str


MetadataValue = (
    float
    | int
    | str
    | bool
    | list[int]
    | list[str]
    | dict[str, float | int | str | bool]
)


class AssistantResponse(BaseModel):
  answer: str
  metadata: dict[str, MetadataValue] | None = None

