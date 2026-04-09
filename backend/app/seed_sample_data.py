from __future__ import annotations

import argparse
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
import random

from sqlalchemy import or_

import app.models  # noqa: F401
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.attendance import Attendance, AttendanceStatus
from app.models.faculty import FacultyProfile
from app.models.result import ResultRecord
from app.models.student import Student
from app.models.subject import Subject
from app.models.timetable import Holiday, Timetable, WeekDay
from app.models.user import User, UserRole
from app.services.faculty_service import create_faculty_profile
from app.services.department_service import ensure_department_catalog_entry
from app.services.student_service import create_student
from app.services.timetable_service import replace_weekly_timetable
from app.schemas.student import StudentCreate
from app.schemas.timetable import WeeklyTimetableUpsertRequest, WeeklyTimetableSlot


DEMO_DOMAIN = "studentmsdemo.edu"
LEGACY_DEMO_DOMAINS = ["demo.studentms.local", DEMO_DOMAIN]
DEMO_PASSWORD = "Demo@123"
CURRENT_YEAR = 2026
DEPARTMENT_OPTIONS = [
    {
        "label": "BTECH CSE",
        "code": "CSE",
        "batches": [2023, 2024, 2025, 2026],
        "max_semester": 8,
        "faculty_count": 8,
        "student_count": 30,
        "subjects": [
            ("Programming Fundamentals", "PF"),
            ("Data Structures", "DS"),
            ("Database Management Systems", "DBMS"),
            ("Operating Systems", "OS"),
            ("Computer Networks", "CN"),
            ("Software Engineering", "SE"),
            ("Theory of Computation", "TOC"),
            ("Artificial Intelligence", "AI"),
        ],
    },
    {
        "label": "BTECH ECE",
        "code": "ECE",
        "batches": [2023, 2024, 2025, 2026],
        "max_semester": 8,
        "faculty_count": 7,
        "student_count": 28,
        "subjects": [
            ("Circuit Theory", "CT"),
            ("Signals and Systems", "SS"),
            ("Digital Electronics", "DE"),
            ("Microprocessors", "MP"),
            ("Communication Systems", "CS"),
            ("VLSI Design", "VLSI"),
            ("Embedded Systems", "ES"),
            ("Control Systems", "CTRL"),
        ],
    },
    {
        "label": "MBA",
        "code": "MBA",
        "batches": [2023, 2024, 2025, 2026],
        "max_semester": 4,
        "faculty_count": 5,
        "student_count": 24,
        "subjects": [
            ("Management Principles", "MP"),
            ("Financial Accounting", "FA"),
            ("Marketing Management", "MM"),
            ("Business Analytics", "BA"),
            ("Operations Management", "OM"),
            ("Human Resource Management", "HRM"),
        ],
    },
]

FACULTY_FIRST_NAMES = [
    "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Reyansh", "Kabir", "Ishaan",
    "Anaya", "Diya", "Kiara", "Myra", "Aditi", "Saanvi", "Riya", "Navya",
]
FACULTY_LAST_NAMES = [
    "Sharma", "Verma", "Mehta", "Iyer", "Rao", "Kapoor", "Bose", "Nair",
    "Joshi", "Malhotra", "Reddy", "Kulkarni", "Chopra", "Bhat", "Gupta", "Singh",
]
STUDENT_FIRST_NAMES = [
    "Aarav", "Vihaan", "Krish", "Ishaan", "Dev", "Arnav", "Ayush", "Kunal", "Rohan", "Yash",
    "Anaya", "Diya", "Saanvi", "Kavya", "Ritika", "Meera", "Nisha", "Priya", "Tanvi", "Ira",
    "Neel", "Tanish", "Atharv", "Rahul", "Sneha", "Pooja", "Aman", "Harsh", "Ritu", "Manav",
]
STUDENT_LAST_NAMES = [
    "Sharma", "Patel", "Gupta", "Reddy", "Khan", "Das", "Nair", "Roy", "Agarwal", "Verma",
    "Mishra", "Kulkarni", "Bansal", "Jain", "Thakur", "Saxena", "Pandey", "Yadav", "Pillai", "Ghosh",
]
HOLIDAY_DESCRIPTIONS = [
    ("2026-08-15", "[Demo] Independence Day"),
    ("2026-10-02", "[Demo] Gandhi Jayanti"),
    ("2026-11-12", "[Demo] Diwali Break"),
    ("2026-12-25", "[Demo] Winter Recess"),
]
TIME_ROWS = ["09:00", "09:45", "10:30", "11:15", "13:00", "13:45"]
WEEKDAY_SEQUENCE = [WeekDay.monday, WeekDay.tuesday, WeekDay.wednesday, WeekDay.thursday, WeekDay.friday]


@dataclass
class DepartmentSeedContext:
  department: str
  code: str
  batch_year: int
  semester: int
  subjects: list[Subject]
  faculty_users: list[User]
  students: list[Student]


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(description="Seed realistic demo data for StudentMS")
  parser.add_argument("--reset-sample", action="store_true", help="Delete existing demo-tagged records before seeding")
  parser.add_argument("--student-count", type=int, default=0, help="Override students per batch for all departments")
  return parser.parse_args()


def sample_email(kind: str, slug: str) -> str:
  return f"{slug}@{kind}.{DEMO_DOMAIN}"


def current_semester_for_batch(batch_year: int, max_semester: int) -> int:
  semester = 1 + max(0, CURRENT_YEAR - batch_year) * 2
  return max(1, min(max_semester, semester))


def reset_demo_data(db) -> None:
  user_filters = [User.email.like(f"%@%.{domain}") for domain in LEGACY_DEMO_DOMAINS]
  student_filters = [Student.email.like(f"%@students.{domain}") for domain in LEGACY_DEMO_DOMAINS]
  demo_users = db.query(User).filter(or_(*user_filters)).all()
  demo_user_ids = [user.id for user in demo_users]
  demo_student_ids = [
      student.id
      for student in db.query(Student).filter(or_(*student_filters)).all()
  ]
  demo_subject_ids = [
      subject.id
      for subject in db.query(Subject).filter(Subject.code.like("DEMO-%")).all()
  ]

  db.query(ResultRecord).filter(ResultRecord.subject_id.in_(demo_subject_ids)).delete(synchronize_session=False)
  if demo_student_ids:
    db.query(Attendance).filter(Attendance.student_id.in_(demo_student_ids)).delete(synchronize_session=False)
  if demo_subject_ids:
    db.query(Timetable).filter(Timetable.subject_id.in_(demo_subject_ids)).delete(synchronize_session=False)
  db.query(Holiday).filter(Holiday.description.like("[Demo]%")).delete(synchronize_session=False)
  db.query(Subject).filter(Subject.code.like("DEMO-%")).delete(synchronize_session=False)
  if demo_user_ids:
    db.query(FacultyProfile).filter(FacultyProfile.user_id.in_(demo_user_ids)).delete(synchronize_session=False)
  db.query(Student).filter(or_(*student_filters)).delete(synchronize_session=False)
  db.query(User).filter(or_(*user_filters)).delete(synchronize_session=False)
  db.commit()


def ensure_user(db, *, email: str, role: UserRole, is_active: bool = True) -> User:
  user = db.query(User).filter(User.email == email).first()
  if user:
    return user
  user = User(
      email=email,
      password_hash=hash_password(DEMO_PASSWORD),
      role=role,
      is_active=is_active,
  )
  db.add(user)
  db.commit()
  db.refresh(user)
  return user


def ensure_subject(db, *, name: str, code: str, department: str, batch_year: int, semester: int) -> Subject:
  subject = (
      db.query(Subject)
      .filter(
          Subject.department == department,
          Subject.batch_year == batch_year,
          Subject.semester == semester,
          Subject.name == name,
      )
      .first()
  )
  if subject:
    return subject
  subject = Subject(
      name=name,
      code=code,
      department=department,
      batch_year=batch_year,
      semester=semester,
  )
  db.add(subject)
  db.commit()
  db.refresh(subject)
  return subject


def seed_admins(db) -> None:
  ensure_user(db, email=f"admin@admins.{DEMO_DOMAIN}", role=UserRole.admin)


def build_faculty_name(index: int) -> str:
  return f"{FACULTY_FIRST_NAMES[index % len(FACULTY_FIRST_NAMES)]} {FACULTY_LAST_NAMES[(index * 3) % len(FACULTY_LAST_NAMES)]}"


def build_student_name(index: int) -> str:
  return f"{STUDENT_FIRST_NAMES[index % len(STUDENT_FIRST_NAMES)]} {STUDENT_LAST_NAMES[(index * 5) % len(STUDENT_LAST_NAMES)]}"


def seed_department_people(db, *, department_data: dict, student_override: int = 0) -> list[DepartmentSeedContext]:
  contexts: list[DepartmentSeedContext] = []
  department = department_data["label"]
  code = department_data["code"]
  department_record = ensure_department_catalog_entry(db, department)
  if department_record.code != code:
    department_record.code = code
    db.add(department_record)
    db.commit()
    db.refresh(department_record)
  department = department_record.name
  faculty_count = department_data["faculty_count"]
  student_count = student_override or department_data["student_count"]

  faculty_users: list[User] = []
  for faculty_index in range(faculty_count):
    slug = f"{code.lower()}-faculty-{faculty_index + 1:02d}"
    email = sample_email("faculty", slug)
    user = ensure_user(db, email=email, role=UserRole.teacher)
    if not db.query(FacultyProfile).filter(FacultyProfile.user_id == user.id).first():
      create_faculty_profile(
          db,
          user=user,
          full_name=build_faculty_name(faculty_index),
          department=department,
      )
    faculty_users.append(user)

  for batch_year in department_data["batches"]:
    semester = current_semester_for_batch(batch_year, department_data["max_semester"])
    subjects = [
        ensure_subject(
            db,
            name=subject_name,
            code=f"DEMO-{code}-{batch_year}-{semester}-{subject_code}",
            department=department,
            batch_year=batch_year,
            semester=semester,
        )
        for subject_name, subject_code in department_data["subjects"][: min(6, len(department_data["subjects"]))]
    ]

    students: list[Student] = []
    for student_index in range(student_count):
      slug = f"{code.lower()}-{batch_year}-{student_index + 1:03d}"
      email = sample_email("students", slug)
      existing = db.query(Student).filter(Student.email == email).first()
      if existing:
        students.append(existing)
        continue
      student = create_student(
          db,
          StudentCreate(
              name=build_student_name(student_index),
              department=department,
              batch_year=batch_year,
              semester=semester,
              email=email,
              roll_number=f"{code}-{batch_year}-{student_index + 1:03d}",
          ),
      )
      students.append(student)

    contexts.append(
        DepartmentSeedContext(
            department=department,
            code=code,
            batch_year=batch_year,
            semester=semester,
            subjects=subjects,
            faculty_users=faculty_users,
            students=students,
        ),
    )

  return contexts


def seed_weekly_timetable(db, contexts: list[DepartmentSeedContext]) -> None:
  for context in contexts:
    slots: list[WeeklyTimetableSlot] = []
    faculty_cycle = context.faculty_users or []
    subject_cycle = context.subjects
    for row_index, row in enumerate(TIME_ROWS):
      start_value = time.fromisoformat(f"{row}:00")
      for day_index, day in enumerate(WEEKDAY_SEQUENCE):
        should_schedule = not (day == WeekDay.wednesday and row_index == len(TIME_ROWS) - 1)
        if context.department == "MBA":
          should_schedule = should_schedule and not (day == WeekDay.friday and row_index >= 4)
        if not should_schedule:
          slots.append(
              WeeklyTimetableSlot(
                  day=day,
                  start_time=start_value,
                  subject_id=None,
                  faculty_user_id=None,
                  room=None,
              ),
          )
          continue

        subject = subject_cycle[(row_index + day_index) % len(subject_cycle)]
        faculty_user = faculty_cycle[(row_index * 2 + day_index) % len(faculty_cycle)]
        slots.append(
            WeeklyTimetableSlot(
                day=day,
                start_time=start_value,
                subject_id=subject.id,
                faculty_user_id=faculty_user.id,
                room=f"{context.code}-{(row_index % 3) + 101}",
            ),
        )

    replace_weekly_timetable(
        db,
        WeeklyTimetableUpsertRequest(
            department=context.department,
            batch_year=context.batch_year,
            semester=context.semester,
            slots=slots,
        ),
    )


def seed_holidays(db) -> None:
  for holiday_date, description in HOLIDAY_DESCRIPTIONS:
    existing = db.query(Holiday).filter(Holiday.description == description).first()
    if existing:
      continue
    db.add(Holiday(date=date.fromisoformat(holiday_date), description=description))
  db.commit()


def seed_attendance(db, contexts: list[DepartmentSeedContext]) -> None:
  random.seed(42)
  timetable_entries = (
      db.query(Timetable)
      .filter(Timetable.department.in_([context.department for context in contexts]))
      .order_by(Timetable.batch_year, Timetable.day, Timetable.start_time)
      .all()
  )
  students_by_group: dict[tuple[str, int, int], list[Student]] = defaultdict(list)
  for context in contexts:
    students_by_group[(context.department, context.batch_year, context.semester)] = context.students

  today = datetime.now(UTC).date()
  weekday_to_index = {
      WeekDay.monday: 0,
      WeekDay.tuesday: 1,
      WeekDay.wednesday: 2,
      WeekDay.thursday: 3,
      WeekDay.friday: 4,
      WeekDay.saturday: 5,
      WeekDay.sunday: 6,
  }

  for entry in timetable_entries:
    matching_students = students_by_group.get((entry.department, entry.batch_year, entry.semester), [])
    if not matching_students:
      continue

    class_dates: list[date] = []
    delta = (today.weekday() - weekday_to_index[entry.day]) % 7
    latest_class_date = today - timedelta(days=delta)
    for week_offset in range(4):
      class_dates.append(latest_class_date - timedelta(days=week_offset * 7))

    for class_date in class_dates:
      for student in matching_students:
        exists = (
            db.query(Attendance.id)
            .filter(
                Attendance.student_id == student.id,
                Attendance.subject_id == entry.subject_id,
                Attendance.date == class_date,
            )
            .first()
        )
        if exists:
          continue
        status_roll = random.random()
        if status_roll < 0.82:
          status_value = AttendanceStatus.present
        elif status_roll < 0.93:
          status_value = AttendanceStatus.late
        else:
          status_value = AttendanceStatus.absent
        db.add(
            Attendance(
                student_id=student.id,
                subject_id=entry.subject_id,
                date=class_date,
                status=status_value,
            ),
        )
  db.commit()


def grade_for_marks(marks_obtained: int, max_marks: int) -> str:
  percentage = (marks_obtained / max_marks) * 100
  if percentage >= 85:
    return "A+"
  if percentage >= 75:
    return "A"
  if percentage >= 65:
    return "B+"
  if percentage >= 55:
    return "B"
  if percentage >= 45:
    return "C"
  return "F"


def remarks_for_grade(grade: str) -> str:
  return {
      "A+": "Outstanding performance",
      "A": "Very strong understanding",
      "B+": "Consistent work",
      "B": "Good progress",
      "C": "Needs more revision",
      "F": "Requires academic support",
  }[grade]


def seed_results(db, contexts: list[DepartmentSeedContext]) -> None:
  random.seed(84)
  assessment_templates = [
      ("Internal Assessment 1", "internal", 30),
      ("Mid Semester", "midsem", 50),
      ("End Semester", "endsem", 100),
  ]

  for context in contexts:
    for student in context.students:
      for subject in context.subjects:
        for assessment_name, exam_type, max_marks in assessment_templates:
          exists = (
              db.query(ResultRecord.id)
              .filter(
                  ResultRecord.student_id == student.id,
                  ResultRecord.subject_id == subject.id,
                  ResultRecord.assessment_name == assessment_name,
              )
              .first()
          )
          if exists:
            continue

          marks_obtained = random.randint(max_marks // 2, max_marks)
          grade = grade_for_marks(marks_obtained, max_marks)
          db.add(
              ResultRecord(
                  student_id=student.id,
                  subject_id=subject.id,
                  subject_name=subject.name,
                  assessment_name=assessment_name,
                  exam_type=exam_type,
                  max_marks=max_marks,
                  marks_obtained=marks_obtained,
                  grade=grade,
                  remarks=remarks_for_grade(grade),
              ),
          )
  db.commit()


def main() -> None:
  args = parse_args()
  db = SessionLocal()
  try:
    if args.reset_sample:
      reset_demo_data(db)

    seed_admins(db)
    contexts: list[DepartmentSeedContext] = []
    for department_data in DEPARTMENT_OPTIONS:
      contexts.extend(seed_department_people(db, department_data=department_data, student_override=args.student_count))

    seed_weekly_timetable(db, contexts)
    seed_holidays(db)
    seed_attendance(db, contexts)
    seed_results(db, contexts)

    faculty_total = db.query(FacultyProfile).filter(FacultyProfile.email.like(f"%@faculty.{DEMO_DOMAIN}")).count()
    student_total = db.query(Student).filter(Student.email.like(f"%@students.{DEMO_DOMAIN}")).count()
    subject_total = db.query(Subject).filter(Subject.code.like("DEMO-%")).count()
    result_total = db.query(ResultRecord).count()
    print("Sample data seeded successfully.")
    print(f"Login password for all demo accounts: {DEMO_PASSWORD}")
    print(f"Demo admin: admin@admins.{DEMO_DOMAIN}")
    print(f"Faculty profiles seeded: {faculty_total}")
    print(f"Students seeded: {student_total}")
    print(f"Subjects seeded: {subject_total}")
    print(f"Results seeded: {result_total}")
  finally:
    db.close()


if __name__ == "__main__":
  main()
