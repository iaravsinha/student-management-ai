from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.attendance import Attendance, AttendanceStatus
from app.models.department import Department
from app.models.faculty import FacultyProfile
from app.models.result import ResultRecord
from app.models.student import Student
from app.models.subject import Subject
from app.models.timetable import Timetable
from app.models.user import User, UserRole
from app.schemas.overview import (
    AcademicOverviewResponse,
    FlowNode,
    ModuleAccess,
    OverviewMetrics,
    PersonalOverview,
)
from app.services import department_service


MODULES = [
    ModuleAccess(
        key="authentication",
        title="Authentication & Authorization",
        description="JWT login, active-account checks, and role-gated route access.",
        access_roles=[UserRole.admin, UserRole.teacher, UserRole.student],
    ),
    ModuleAccess(
        key="user_management",
        title="User Management",
        description="Admin creates accounts and links teacher/student records.",
        access_roles=[UserRole.admin],
    ),
    ModuleAccess(
        key="department_management",
        title="Department Management",
        description="Shared academic structure used by students, faculty, subjects, and timetable.",
        access_roles=[UserRole.admin, UserRole.teacher],
    ),
    ModuleAccess(
        key="course_subject_management",
        title="Course & Subject Management",
        description="Subjects are attached to department, batch, and semester before scheduling.",
        access_roles=[UserRole.admin, UserRole.teacher, UserRole.student],
    ),
    ModuleAccess(
        key="student_records",
        title="Student Records",
        description="Student lifecycle records drive attendance, results, and personalized views.",
        access_roles=[UserRole.admin, UserRole.teacher, UserRole.student],
    ),
    ModuleAccess(
        key="teacher_records",
        title="Teacher Records",
        description="Faculty profiles connect teacher accounts to departments and timetable ownership.",
        access_roles=[UserRole.admin, UserRole.teacher],
    ),
    ModuleAccess(
        key="timetable_management",
        title="Timetable Management",
        description="Weekly scheduling links subjects, teachers, rooms, and class cohorts.",
        access_roles=[UserRole.admin, UserRole.teacher, UserRole.student],
    ),
    ModuleAccess(
        key="attendance",
        title="Attendance Management",
        description="Teachers mark attendance on their own timetable-linked classes; students get read-only views.",
        access_roles=[UserRole.admin, UserRole.teacher, UserRole.student],
    ),
    ModuleAccess(
        key="grades",
        title="Grades & Exams",
        description="Result records connect students, subjects, and exam assessments.",
        access_roles=[UserRole.admin, UserRole.teacher, UserRole.student],
    ),
    ModuleAccess(
        key="academic_calendar",
        title="Academic Calendar",
        description="Holidays and semester scheduling context support the institutional calendar flow.",
        access_roles=[UserRole.admin, UserRole.teacher, UserRole.student],
    ),
]


def _metrics(db: Session) -> OverviewMetrics:
  return OverviewMetrics(
      department_count=db.query(func.count()).select_from(Department).scalar() or 0,
      faculty_count=db.query(func.count(FacultyProfile.id)).scalar() or 0,
      student_count=db.query(func.count(Student.id)).scalar() or 0,
      subject_count=db.query(func.count(Subject.id)).scalar() or 0,
      timetable_slot_count=db.query(func.count(Timetable.id)).scalar() or 0,
      attendance_record_count=db.query(func.count(Attendance.id)).scalar() or 0,
      result_record_count=db.query(func.count(ResultRecord.id)).scalar() or 0,
  )


def _dependency_flow(db: Session) -> list[FlowNode]:
  return [
      FlowNode(
          entity="Department",
          upstream=[],
          downstream=["Subject", "Teacher", "Student"],
          live_records=db.query(func.count()).select_from(Department).scalar() or 0,
      ),
      FlowNode(
          entity="Subject",
          upstream=["Department"],
          downstream=["Timetable", "Attendance", "Grades"],
          live_records=db.query(func.count(Subject.id)).scalar() or 0,
      ),
      FlowNode(
          entity="Teacher",
          upstream=["Department"],
          downstream=["Timetable", "Attendance"],
          live_records=db.query(func.count(FacultyProfile.id)).scalar() or 0,
      ),
      FlowNode(
          entity="Student",
          upstream=["Department"],
          downstream=["Attendance", "Grades"],
          live_records=db.query(func.count(Student.id)).scalar() or 0,
      ),
      FlowNode(
          entity="Timetable",
          upstream=["Subject", "Teacher"],
          downstream=["Attendance"],
          live_records=db.query(func.count(Timetable.id)).scalar() or 0,
      ),
      FlowNode(
          entity="Attendance",
          upstream=["Student", "Subject", "Timetable"],
          downstream=["Student Dashboard", "Admin Analytics"],
          live_records=db.query(func.count(Attendance.id)).scalar() or 0,
      ),
      FlowNode(
          entity="Grades",
          upstream=["Student", "Subject"],
          downstream=["Student Dashboard", "Admin Analytics"],
          live_records=db.query(func.count(ResultRecord.id)).scalar() or 0,
      ),
  ]


def _today_name() -> str:
  return datetime.now().strftime("%A").lower()


def _personal_overview(db: Session, current_user: User) -> PersonalOverview | None:
  if current_user.role == UserRole.teacher:
    faculty = db.query(FacultyProfile).filter(FacultyProfile.user_id == current_user.id).first()
    if not faculty:
      return None
    today_class_count = (
        db.query(func.count(Timetable.id))
        .filter(Timetable.faculty_user_id == current_user.id, Timetable.day == _today_name())
        .scalar()
        or 0
    )
    assigned_subject_count = (
        db.query(func.count(func.distinct(Timetable.subject_id)))
        .filter(Timetable.faculty_user_id == current_user.id)
        .scalar()
        or 0
    )
    student_count = (
        db.query(func.count(Student.id))
        .filter(Student.department == faculty.department)
        .scalar()
        or 0
    )
    return PersonalOverview(
        label=faculty.name,
        department=faculty.department,
        timetable_slot_count=db.query(func.count(Timetable.id)).filter(Timetable.faculty_user_id == current_user.id).scalar() or 0,
        today_class_count=today_class_count,
        assigned_subject_count=assigned_subject_count,
        attendance_record_count=(
            db.query(func.count(Attendance.id))
            .join(Student, Student.id == Attendance.student_id)
            .filter(Student.department == faculty.department)
            .scalar()
            or 0
        ),
        result_record_count=(
            db.query(func.count(ResultRecord.id))
            .join(Student, Student.id == ResultRecord.student_id)
            .filter(Student.department == faculty.department)
            .scalar()
            or 0
        ),
    )

  if current_user.role == UserRole.student:
    student = db.query(Student).filter(Student.email == current_user.email).first()
    if not student:
      return None
    attendance_total = db.query(func.count(Attendance.id)).filter(Attendance.student_id == student.id).scalar() or 0
    present_total = (
        db.query(func.count(Attendance.id))
        .filter(
            Attendance.student_id == student.id,
            Attendance.status.in_([AttendanceStatus.present, AttendanceStatus.late]),
        )
        .scalar()
        or 0
    )
    overall_attendance = round((present_total / attendance_total) * 100, 2) if attendance_total else None
    today_class_count = (
        db.query(func.count(Timetable.id))
        .filter(
            Timetable.department == student.department,
            Timetable.batch_year == student.batch_year,
            Timetable.semester == student.semester,
            Timetable.day == _today_name(),
        )
        .scalar()
        or 0
    )
    return PersonalOverview(
        label=student.name,
        department=student.department,
        batch_year=student.batch_year,
        semester=student.semester,
        timetable_slot_count=(
            db.query(func.count(Timetable.id))
            .filter(
                Timetable.department == student.department,
                Timetable.batch_year == student.batch_year,
                Timetable.semester == student.semester,
            )
            .scalar()
            or 0
        ),
        today_class_count=today_class_count,
        attendance_record_count=attendance_total,
        result_record_count=db.query(func.count(ResultRecord.id)).filter(ResultRecord.student_id == student.id).scalar() or 0,
        overall_attendance_percentage=overall_attendance,
    )

  return PersonalOverview(label="Administrator")


def build_academic_overview(db: Session, current_user: User) -> AcademicOverviewResponse:
  return AcademicOverviewResponse(
      role=current_user.role,
      hierarchy=[UserRole.admin, UserRole.teacher, UserRole.student],
      metrics=_metrics(db),
      modules=MODULES,
      dependency_flow=_dependency_flow(db),
      departments=department_service.list_departments_with_summary(db),
      personal=_personal_overview(db, current_user),
  )
