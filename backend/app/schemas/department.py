from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DepartmentBase(BaseModel):
  name: str = Field(min_length=2, max_length=100)
  code: str = Field(min_length=2, max_length=20)
  batch_start_year: int = Field(ge=2000, le=2100)
  batch_end_year: int = Field(ge=2000, le=2100)
  semester_count: int = Field(ge=1, le=20)
  head_user_id: int | None = Field(default=None, gt=0)
  is_active: bool = True


class DepartmentCreate(DepartmentBase):
  pass


class DepartmentUpdate(BaseModel):
  model_config = ConfigDict(extra="forbid")

  name: str | None = Field(default=None, min_length=2, max_length=100)
  code: str | None = Field(default=None, min_length=2, max_length=20)
  batch_start_year: int | None = Field(default=None, ge=2000, le=2100)
  batch_end_year: int | None = Field(default=None, ge=2000, le=2100)
  semester_count: int | None = Field(default=None, ge=1, le=20)
  head_user_id: int | None = Field(default=None, gt=0)
  is_active: bool | None = None


class DepartmentRead(DepartmentBase):
  model_config = ConfigDict(from_attributes=True)

  id: int
  created_at: datetime


class DepartmentSummary(DepartmentRead):
  faculty_count: int = 0
  student_count: int = 0
  subject_count: int = 0
  timetable_slot_count: int = 0
  attendance_record_count: int = 0
  result_record_count: int = 0
  active_batches: list[int] = Field(default_factory=list)
  active_semesters: list[int] = Field(default_factory=list)
