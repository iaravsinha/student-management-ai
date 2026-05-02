from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class StudentBase(BaseModel):
  name: str = Field(min_length=2, max_length=120)
  department: str = Field(min_length=2, max_length=100)
  batch_year: int = Field(ge=2000, le=2100)
  semester: int = Field(ge=1, le=12)
  email: EmailStr
  roll_number: str | None = Field(default=None, min_length=1, max_length=50)


class StudentCreate(StudentBase):
  pass


class StudentUpdate(BaseModel):
  model_config = ConfigDict(extra="forbid")

  name: str | None = Field(default=None, min_length=2, max_length=120)
  enrollment_number: str | None = Field(default=None, min_length=1, max_length=50)
  roll_number: str | None = Field(default=None, min_length=1, max_length=50)
  department: str | None = Field(default=None, min_length=2, max_length=100)
  batch_year: int | None = Field(default=None, ge=2000, le=2100)
  semester: int | None = Field(default=None, ge=1, le=12)
  email: EmailStr | None = None


class StudentRead(StudentBase):
  model_config = ConfigDict(from_attributes=True)

  id: int
  enrollment_number: str
  created_at: datetime


class StudentListResponse(BaseModel):
  items: list[StudentRead]
  total: int
  page: int
  page_size: int


class StudentImportRowError(BaseModel):
  row: int
  email: str | None = None
  reason: str


class StudentImportSummary(BaseModel):
  inserted: int
  skipped: int
  total_rows: int
  errors: list[StudentImportRowError] = Field(default_factory=list)

