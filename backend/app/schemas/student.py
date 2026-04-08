from pydantic import BaseModel, EmailStr


class StudentBase(BaseModel):
  first_name: str
  last_name: str
  email: EmailStr
  enrollment_number: str


class StudentCreate(StudentBase):
  pass


class StudentRead(StudentBase):
  id: int

  class Config:
    from_attributes = True

