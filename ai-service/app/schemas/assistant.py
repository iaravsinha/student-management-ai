from datetime import date as dt_date
from typing import Any, Optional
from typing import Literal

from pydantic import BaseModel, Field


class AssistantChatTurn(BaseModel):
  role: Literal["user", "assistant"]
  content: str = Field(min_length=1, max_length=4000)


class AssistantQuery(BaseModel):
  student_id: Optional[int] = Field(default=None, gt=0)
  timetable_id: Optional[int] = Field(default=None, gt=0)
  date: Optional[dt_date] = None
  query: str = Field(min_length=1, max_length=2000)
  execute: bool = False
  conversation_history: list[AssistantChatTurn] = Field(default_factory=list, max_length=20)


class StructuredCommand(BaseModel):
  actions: list[str] = Field(default_factory=list)
  student_id: Optional[int] = None
  timetable_id: Optional[int] = None
  date: Optional[dt_date] = None
  present_roll_numbers: list[str] = Field(default_factory=list)
  absent_roll_numbers: list[str] = Field(default_factory=list)
  subject_name: str | None = None
  subject_code: str | None = None
  department: str | None = None
  batch_year: int | None = None
  semester: int | None = None
  message: str | None = None


class AssistantResponse(BaseModel):
  answer: str
  command: Optional[StructuredCommand] = None
  metadata: Optional[dict[str, Any]] = None

