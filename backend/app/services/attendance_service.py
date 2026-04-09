from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.attendance import Attendance, AttendanceStatus
from app.models.faculty import FacultyProfile
from app.models.student import Student
from app.models.timetable import Timetable
from app.models.user import User, UserRole
from app.schemas.attendance import AttendanceBulkMarkRequest, AttendanceMarkRequest


def _ensure_student_exists(db: Session, student_id: int) -> None:
  exists = db.query(Student.id).filter(Student.id == student_id).first()
  if not exists:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Student not found",
    )


def ensure_attendance_access(db: Session, current_user: User, student_id: int) -> None:
  if current_user.role != UserRole.student:
    if current_user.role == UserRole.teacher:
      faculty_profile = db.query(FacultyProfile).filter(FacultyProfile.user_id == current_user.id).first()
      student = db.query(Student).filter(Student.id == student_id).first()
      if not faculty_profile or not student or student.department != faculty_profile.department:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teachers can only access attendance for students in their department",
        )
    return
  student = db.query(Student).filter(Student.id == student_id).first()
  if not student or student.email != current_user.email:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Students can only access their own attendance",
    )


def _upsert_attendance_record(
    db: Session,
    *,
    student_id: int,
    subject_id: int,
    attendance_date,
    status_value: AttendanceStatus,
) -> Attendance:
  record = (
      db.query(Attendance)
      .filter(
          Attendance.student_id == student_id,
          Attendance.subject_id == subject_id,
          Attendance.date == attendance_date,
      )
      .first()
  )
  if record:
    record.status = status_value
    return record

  record = Attendance(
      student_id=student_id,
      subject_id=subject_id,
      date=attendance_date,
      status=status_value,
  )
  return record


def mark_attendance(db: Session, payload: AttendanceMarkRequest, *, current_user: User) -> Attendance:
  _ensure_student_exists(db, payload.student_id)

  if current_user.role == UserRole.teacher:
    student = db.query(Student).filter(Student.id == payload.student_id).first()
    class_exists = (
        db.query(Timetable.id)
        .filter(
            Timetable.faculty_user_id == current_user.id,
            Timetable.subject_id == payload.subject_id,
            Timetable.department == student.department,
            Timetable.batch_year == student.batch_year,
            Timetable.semester == student.semester,
        )
        .first()
    )
    if not class_exists:
      raise HTTPException(
          status_code=status.HTTP_403_FORBIDDEN,
          detail="Teachers can only mark attendance for students in their assigned classes",
      )

  record = _upsert_attendance_record(
      db,
      student_id=payload.student_id,
      subject_id=payload.subject_id,
      attendance_date=payload.date,
      status_value=payload.status,
  )
  db.add(record)
  db.commit()
  db.refresh(record)
  return record


def mark_bulk_attendance_for_class(
    db: Session,
    payload: AttendanceBulkMarkRequest,
    *,
    current_user: User,
) -> list[Attendance]:
  timetable = db.query(Timetable).filter(Timetable.id == payload.timetable_id).first()
  if not timetable:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Timetable entry not found",
    )
  if timetable.faculty_user_id != current_user.id:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Teachers can only mark attendance for their own classes",
    )

  students = (
      db.query(Student)
      .filter(
          Student.department == timetable.department,
          Student.batch_year == timetable.batch_year,
          Student.semester == timetable.semester,
      )
      .all()
  )
  student_ids = {student.id for student in students}
  submitted_ids = {record.student_id for record in payload.records}

  if not submitted_ids.issubset(student_ids):
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Attendance can only be marked for students in the selected class",
    )

  saved_records: list[Attendance] = []
  for entry in payload.records:
    record = _upsert_attendance_record(
        db,
        student_id=entry.student_id,
        subject_id=timetable.subject_id,
        attendance_date=payload.date,
        status_value=entry.status,
    )
    db.add(record)
    saved_records.append(record)

  db.commit()
  for record in saved_records:
    db.refresh(record)
  return saved_records


def get_class_attendance_for_date(
    db: Session,
    *,
    timetable_id: int,
    attendance_date,
    current_user: User,
) -> list[Attendance]:
  timetable = db.query(Timetable).filter(Timetable.id == timetable_id).first()
  if not timetable:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Timetable entry not found",
    )
  if timetable.faculty_user_id != current_user.id:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Teachers can only access attendance for their own classes",
    )

  return (
      db.query(Attendance)
      .join(Student, Student.id == Attendance.student_id)
      .filter(
          Attendance.subject_id == timetable.subject_id,
          Attendance.date == attendance_date,
          Student.department == timetable.department,
          Student.batch_year == timetable.batch_year,
          Student.semester == timetable.semester,
      )
      .order_by(Attendance.student_id.asc())
      .all()
  )


def get_attendance_history(db: Session, student_id: int) -> list[Attendance]:
  _ensure_student_exists(db, student_id)
  return (
      db.query(Attendance)
      .filter(Attendance.student_id == student_id)
      .order_by(Attendance.date.desc(), Attendance.id.desc())
      .all()
  )


def calculate_attendance_percentage(
    db: Session,
    student_id: int,
    subject_id: int,
) -> tuple[int, int, float]:
  _ensure_student_exists(db, student_id)

  total_classes = (
      db.query(func.count(Attendance.id))
      .filter(
          Attendance.student_id == student_id,
          Attendance.subject_id == subject_id,
      )
      .scalar()
      or 0
  )
  attended_classes = (
      db.query(func.count(Attendance.id))
      .filter(
          Attendance.student_id == student_id,
          Attendance.subject_id == subject_id,
          Attendance.status == AttendanceStatus.present,
      )
      .scalar()
      or 0
  )
  percentage = (attended_classes / total_classes) * 100 if total_classes else 0.0
  return total_classes, attended_classes, round(percentage, 2)

