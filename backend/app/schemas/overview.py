from pydantic import BaseModel, Field

from app.models.user import UserRole
from app.schemas.department import DepartmentSummary


class ModuleAccess(BaseModel):
  key: str
  title: str
  description: str
  access_roles: list[UserRole]


class FlowNode(BaseModel):
  entity: str
  upstream: list[str] = Field(default_factory=list)
  downstream: list[str] = Field(default_factory=list)
  live_records: int


class OverviewMetrics(BaseModel):
  department_count: int
  faculty_count: int
  student_count: int
  subject_count: int
  timetable_slot_count: int
  attendance_record_count: int
  result_record_count: int


class PersonalOverview(BaseModel):
  label: str
  department: str | None = None
  batch_year: int | None = None
  semester: int | None = None
  timetable_slot_count: int = 0
  today_class_count: int = 0
  assigned_subject_count: int = 0
  attendance_record_count: int = 0
  result_record_count: int = 0
  overall_attendance_percentage: float | None = None


class AcademicOverviewResponse(BaseModel):
  role: UserRole
  hierarchy: list[UserRole]
  metrics: OverviewMetrics
  modules: list[ModuleAccess]
  dependency_flow: list[FlowNode]
  departments: list[DepartmentSummary]
  personal: PersonalOverview | None = None
