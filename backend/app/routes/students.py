from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.student import Student
from app.schemas.student import StudentCreate, StudentRead

router = APIRouter()


@router.get("/", response_model=List[StudentRead])
def list_students(db: Session = Depends(get_db)):
  return db.query(Student).all()


@router.post("/", response_model=StudentRead, status_code=status.HTTP_201_CREATED)
def create_student(payload: StudentCreate, db: Session = Depends(get_db)):
  existing = (
      db.query(Student)
      .filter(
          (Student.email == payload.email)
          | (Student.enrollment_number == payload.enrollment_number),
      )
      .first()
  )
  if existing:
    raise HTTPException(status_code=400, detail="Student already exists")

  student = Student(**payload.model_dump())
  db.add(student)
  db.commit()
  db.refresh(student)
  return student

