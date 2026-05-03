from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.models.attendance import AttendanceStatus


class AttendanceMarkRequest(BaseModel):
  student_id: int = Field(gt=0)
  subject_id: int = Field(gt=0)
  date: date
  status: AttendanceStatus
  remarks: str | None = None


class AttendanceBulkStudentRecord(BaseModel):
  student_id: int = Field(gt=0)
  status: AttendanceStatus
  remarks: str | None = None


class AttendanceBulkMarkRequest(BaseModel):
  timetable_id: int = Field(gt=0)
  date: date
  records: list[AttendanceBulkStudentRecord] = Field(min_length=1)


class AttendanceRead(BaseModel):
  model_config = ConfigDict(from_attributes=True)

  id: int
  student_id: int
  subject_id: int
  date: date
  status: AttendanceStatus
  remarks: str | None = None


class AttendancePercentageResponse(BaseModel):
  student_id: int
  subject_id: int
  total_classes: int
  attended_classes: int
  attendance_percentage: float
