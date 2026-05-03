from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SubjectBase(BaseModel):
  name: str = Field(min_length=2, max_length=120)
  code: str = Field(min_length=2, max_length=40)
  syllabus: str | None = Field(default=None, max_length=5000)
  department: str = Field(min_length=2, max_length=100)
  batch_year: int = Field(ge=2000, le=2100)
  semester: int = Field(ge=1, le=12)


class SubjectCreate(SubjectBase):
  pass


class SubjectUpdate(BaseModel):
  model_config = ConfigDict(extra="forbid")

  name: str | None = Field(default=None, min_length=2, max_length=120)
  code: str | None = Field(default=None, min_length=2, max_length=40)
  syllabus: str | None = Field(default=None, max_length=5000)
  department: str | None = Field(default=None, min_length=2, max_length=100)
  batch_year: int | None = Field(default=None, ge=2000, le=2100)
  semester: int | None = Field(default=None, ge=1, le=12)


class SubjectRead(SubjectBase):
  model_config = ConfigDict(from_attributes=True)

  id: int
  created_at: datetime
