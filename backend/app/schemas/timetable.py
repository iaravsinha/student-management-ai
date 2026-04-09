from datetime import date, time

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.timetable import WeekDay


class TimetableBase(BaseModel):
  day: WeekDay
  subject_id: int = Field(gt=0)
  subject_name: str = Field(min_length=2, max_length=120)
  department: str = Field(min_length=2, max_length=100)
  batch_year: int = Field(ge=2000, le=2100)
  semester: int = Field(ge=1, le=12)
  faculty_user_id: int = Field(gt=0)
  room: str | None = Field(default=None, max_length=50)
  start_time: time
  end_time: time

  @model_validator(mode="after")
  def validate_time_order(self):
    if self.end_time <= self.start_time:
      raise ValueError("end_time must be after start_time")
    return self


class TimetableCreate(TimetableBase):
  pass


class TimetableRead(TimetableBase):
  model_config = ConfigDict(from_attributes=True)
  id: int


class WeeklyTimetableSlot(BaseModel):
  day: WeekDay
  start_time: time
  subject_id: int | None = Field(default=None, gt=0)
  faculty_user_id: int | None = Field(default=None, gt=0)
  room: str | None = Field(default=None, max_length=50)


class WeeklyTimetableUpsertRequest(BaseModel):
  department: str = Field(min_length=2, max_length=100)
  batch_year: int = Field(ge=2000, le=2100)
  semester: int = Field(ge=1, le=12)
  slots: list[WeeklyTimetableSlot]


class HolidayBase(BaseModel):
  date: date
  description: str = Field(min_length=1, max_length=255)


class HolidayCreate(HolidayBase):
  pass


class HolidayRead(HolidayBase):
  model_config = ConfigDict(from_attributes=True)
  id: int

