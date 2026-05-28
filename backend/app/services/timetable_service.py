from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.faculty import FacultyProfile
from app.models.student import Student
from app.models.subject import Subject
from app.models.timetable import Holiday, Timetable, WeekDay
from app.models.user import User, UserRole
from app.schemas.timetable import HolidayCreate, TimetableCreate, WeeklyTimetableUpsertRequest
from app.services import department_service


CLASS_DURATION = timedelta(minutes=settings.CLASS_DURATION_MINUTES)


def create_timetable_entry(db: Session, payload: TimetableCreate) -> Timetable:
  department = department_service.require_department(db, payload.department)
  subject = db.query(Subject).filter(Subject.id == payload.subject_id).first()
  if not subject:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Selected subject was not found",
    )
  if (
      subject.department != department.name
      or subject.batch_year != payload.batch_year
      or subject.semester != payload.semester
  ):
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Selected subject does not belong to the chosen department, batch, and semester",
    )

  faculty_profile = db.query(FacultyProfile).filter(FacultyProfile.user_id == payload.faculty_user_id).first()
  if not faculty_profile:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Faculty profile not found for the selected teacher",
    )
  if faculty_profile.department != department.name:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Selected faculty does not belong to the chosen department",
    )
  start_dt = datetime.combine(datetime.today().date(), payload.start_time)
  end_dt = datetime.combine(datetime.today().date(), payload.end_time)
  if end_dt - start_dt != CLASS_DURATION:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Each class slot must be exactly 45 minutes long",
    )
  existing = (
      db.query(Timetable)
      .filter(
          Timetable.day == payload.day,
          Timetable.department == department.name,
          Timetable.batch_year == payload.batch_year,
          Timetable.semester == payload.semester,
          Timetable.start_time == payload.start_time,
          Timetable.end_time == payload.end_time,
      )
      .first()
  )
  if existing:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Timetable slot already exists",
    )
  faculty_conflict = (
      db.query(Timetable.id)
      .filter(
          Timetable.day == payload.day,
          Timetable.faculty_user_id == payload.faculty_user_id,
          Timetable.start_time == payload.start_time,
          Timetable.end_time == payload.end_time,
      )
      .first()
  )
  if faculty_conflict:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Selected faculty already has a class in this time slot",
    )

  data = payload.model_dump()
  data["department"] = department.name
  data["subject_name"] = subject.name
  entry = Timetable(**data)
  db.add(entry)
  db.commit()
  db.refresh(entry)
  return entry


def list_timetable(db: Session) -> list[Timetable]:
  return db.query(Timetable).order_by(Timetable.day, Timetable.start_time).all()


def list_timetable_for_user(db: Session, current_user: User) -> list[Timetable]:
  return list_timetable_for_user_with_filters(db, current_user)


def list_timetable_for_user_with_filters(
    db: Session,
    current_user: User,
    *,
    department: str | None = None,
    batch_year: int | None = None,
    semester: int | None = None,
) -> list[Timetable]:
  query = db.query(Timetable)
  if current_user.role == UserRole.teacher:
    query = query.filter(Timetable.faculty_user_id == current_user.id)
  elif current_user.role == UserRole.student:
    student = db.query(Student).filter(Student.email == current_user.email).first()
    if not student:
      raise HTTPException(
          status_code=status.HTTP_404_NOT_FOUND,
          detail="Student profile not found for this account",
      )
    query = query.filter(
        Timetable.department == student.department,
        Timetable.batch_year == student.batch_year,
        Timetable.semester == student.semester,
    )
  if department:
    query = query.filter(Timetable.department == department)
  if batch_year is not None:
    query = query.filter(Timetable.batch_year == batch_year)
  if semester is not None:
    query = query.filter(Timetable.semester == semester)
  return query.order_by(Timetable.day, Timetable.start_time).all()


def get_timetable_by_id(db: Session, timetable_id: int) -> Timetable:
  entry = db.query(Timetable).filter(Timetable.id == timetable_id).first()
  if not entry:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Timetable entry not found",
    )
  return entry


def ensure_timetable_access(db: Session, current_user: User, timetable_id: int) -> Timetable:
  entry = get_timetable_by_id(db, timetable_id)
  if current_user.role == UserRole.teacher and entry.faculty_user_id != current_user.id:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Teachers can only access their own classes",
    )
  if current_user.role == UserRole.student:
    student = db.query(Student).filter(Student.email == current_user.email).first()
    if not student:
      raise HTTPException(
          status_code=status.HTTP_404_NOT_FOUND,
          detail="Student profile not found for this account",
      )
    if (
        entry.department != student.department
        or entry.batch_year != student.batch_year
        or entry.semester != student.semester
    ):
      raise HTTPException(
          status_code=status.HTTP_403_FORBIDDEN,
          detail="Students can only access timetable entries for their own class",
      )
  return entry


def get_timetable_by_day(db: Session, day: WeekDay) -> list[Timetable]:
  return (
      db.query(Timetable)
      .filter(Timetable.day == day)
      .order_by(Timetable.start_time)
      .all()
  )


def list_timetable_for_user_by_day(db: Session, current_user: User, day: WeekDay) -> list[Timetable]:
  return [
      entry
      for entry in list_timetable_for_user(db, current_user)
      if entry.day == day
  ]


def replace_weekly_timetable(
    db: Session,
    payload: WeeklyTimetableUpsertRequest,
) -> list[Timetable]:
  department = department_service.require_department(db, payload.department)
  seen_slots: set[tuple[WeekDay, str]] = set()
  seen_faculty_slots: set[tuple[int, WeekDay, str]] = set()
  normalized_entries: list[Timetable] = []

  for slot in payload.slots:
    slot_key = (slot.day, slot.start_time.isoformat())
    if slot_key in seen_slots:
      raise HTTPException(
          status_code=status.HTTP_400_BAD_REQUEST,
          detail="Duplicate weekly slot detected for the same day and start time",
      )
    seen_slots.add(slot_key)

    if slot.subject_id is None:
      continue
    if slot.faculty_user_id is None:
      raise HTTPException(
          status_code=status.HTTP_400_BAD_REQUEST,
          detail="Faculty is required for scheduled classes",
      )

    subject = db.query(Subject).filter(Subject.id == slot.subject_id).first()
    if not subject:
      raise HTTPException(
          status_code=status.HTTP_404_NOT_FOUND,
          detail="One or more selected subjects were not found",
      )
    if (
        subject.department != department.name
        or subject.batch_year != payload.batch_year
        or subject.semester != payload.semester
    ):
      raise HTTPException(
          status_code=status.HTTP_400_BAD_REQUEST,
          detail="Subjects must belong to the same department, batch, and semester as the weekly plan",
      )

    faculty_profile = db.query(FacultyProfile).filter(FacultyProfile.user_id == slot.faculty_user_id).first()
    if not faculty_profile:
      raise HTTPException(
          status_code=status.HTTP_404_NOT_FOUND,
          detail="One or more selected faculty accounts do not have a faculty profile",
      )
    if faculty_profile.department != department.name:
      raise HTTPException(
          status_code=status.HTTP_400_BAD_REQUEST,
          detail="Faculty must belong to the same department as the weekly plan",
      )

    start_dt = datetime.combine(datetime.today().date(), slot.start_time)
    end_time = (start_dt + CLASS_DURATION).time()
    faculty_slot_key = (slot.faculty_user_id, slot.day, slot.start_time.isoformat())
    if faculty_slot_key in seen_faculty_slots:
      raise HTTPException(
          status_code=status.HTTP_400_BAD_REQUEST,
          detail="A faculty member cannot be assigned twice in the same weekly time slot",
      )
    seen_faculty_slots.add(faculty_slot_key)
    faculty_conflict = (
        db.query(Timetable.id)
        .filter(
            Timetable.faculty_user_id == slot.faculty_user_id,
            Timetable.day == slot.day,
            Timetable.start_time == slot.start_time,
            or_(
                Timetable.department != department.name,
                Timetable.batch_year != payload.batch_year,
                Timetable.semester != payload.semester,
            ),
        )
        .first()
    )
    if faculty_conflict:
      raise HTTPException(
          status_code=status.HTTP_409_CONFLICT,
          detail="A faculty member already has a class in another department at this time",
      )
    normalized_entries.append(
        Timetable(
            day=slot.day,
            subject_id=subject.id,
            subject_name=subject.name,
            department=department.name,
            batch_year=payload.batch_year,
            semester=payload.semester,
            faculty_user_id=slot.faculty_user_id,
            room=slot.room,
            start_time=slot.start_time,
            end_time=end_time,
        )
    )

  (
      db.query(Timetable)
      .filter(
          Timetable.department == department.name,
          Timetable.batch_year == payload.batch_year,
          Timetable.semester == payload.semester,
      )
      .delete(synchronize_session=False)
  )
  for entry in normalized_entries:
    db.add(entry)
  db.commit()
  return (
      db.query(Timetable)
      .filter(
          Timetable.department == department.name,
          Timetable.batch_year == payload.batch_year,
          Timetable.semester == payload.semester,
      )
      .order_by(Timetable.day, Timetable.start_time)
      .all()
  )


def create_holiday(db: Session, payload: HolidayCreate) -> Holiday:
  existing = db.query(Holiday).filter(Holiday.date == payload.date).first()
  if existing:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Holiday already exists for this date",
    )
  holiday = Holiday(**payload.model_dump())
  db.add(holiday)
  db.commit()
  db.refresh(holiday)
  return holiday


def list_holidays(db: Session) -> list[Holiday]:
  return db.query(Holiday).order_by(Holiday.date.desc()).all()

