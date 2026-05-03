from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ResultRead(BaseModel):
  model_config = ConfigDict(from_attributes=True)

  id: int
  student_id: int
  subject_id: int
  subject_name: str
  assessment_name: str
  exam_type: str
  semester: int | None = None
  max_marks: int = Field(ge=1)
  marks_obtained: int = Field(ge=0)
  grade: str
  remarks: str | None = None
  created_at: datetime
