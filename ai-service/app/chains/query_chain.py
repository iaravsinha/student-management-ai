from datetime import date
import re

from pydantic import ValidationError

from app.agents.backend_agent import (
    build_subject_percentages,
    create_subject,
    fetch_attendance_history,
    fetch_class_attendance,
    fetch_class_students,
    fetch_current_user,
    fetch_departments,
    fetch_faculty,
    fetch_holidays,
    fetch_overview,
    fetch_permissions,
    fetch_student,
    fetch_students,
    fetch_student_results,
    fetch_subjects,
    fetch_timetable,
    log_ai_action,
    mark_bulk_attendance,
)
from app.core.config import settings
from app.schemas.assistant import StructuredCommand
from app.services.llm_client import answer_from_hosted_llm, command_from_hosted_llm
from app.tools.attendance_tool import (
    attendance_percentage,
    detect_weak_subjects,
    remaining_classes_for_target,
)
from app.tools.grade_tool import build_subject_risk_map


def _roll_key(value: object) -> str:
  text = str(value or "").strip()
  return str(int(text)) if text.isdigit() else text.lower()


def _extract_roll_numbers(text: str) -> list[str]:
  return re.findall(r"\b\d+\b", text)


def _looks_like_general_chat(query: str) -> bool:
  lowered = query.lower()
  operation_markers = [
      "attendance",
      "absent",
      "present",
      "mark",
      "timetable",
      "class",
      "subject",
      "create",
      "add",
      "semester",
      "department",
      "student",
      "students",
      "enrolled",
      "list",
      "all",
      "weak",
      "remaining",
      "predict",
      "roll",
  ]
  return not any(marker in lowered for marker in operation_markers)


def _wants_student_identity(query: str) -> bool:
  lowered = query.lower()
  return any(token in lowered for token in ["student name", "name of the student", "student's name", "who is the student", "show me the name"])


def _wants_performance_context(query: str) -> bool:
  lowered = query.lower()
  return any(token in lowered for token in ["weak", "performance", "result", "grade", "marks", "score"])


def _wants_student_directory(query: str) -> bool:
  lowered = query.lower()
  return any(
      token in lowered
      for token in [
          "all students",
          "list students",
          "name all students",
          "currently enrolled",
          "enrolled students",
      ]
  )


def _wants_departments(query: str) -> bool:
  lowered = query.lower()
  return "department" in lowered and any(token in lowered for token in ["list", "show", "all", "name"])


def _wants_subjects(query: str) -> bool:
  lowered = query.lower()
  return "subject" in lowered and any(token in lowered for token in ["list", "show", "all", "available"])


def _wants_faculty(query: str) -> bool:
  lowered = query.lower()
  return any(token in lowered for token in ["faculty", "teacher"]) and any(token in lowered for token in ["list", "show", "all"])


def _wants_timetable(query: str) -> bool:
  lowered = query.lower()
  return any(token in lowered for token in ["timetable", "schedule", "classes"]) and any(token in lowered for token in ["show", "list", "today", "week"])


def _wants_holidays(query: str) -> bool:
  lowered = query.lower()
  return "holiday" in lowered and any(token in lowered for token in ["show", "list", "upcoming", "next", "all"])


def _wants_overview(query: str) -> bool:
  lowered = query.lower()
  return any(token in lowered for token in ["overview", "summary", "metrics", "stats", "dashboard"])


def _wants_results(query: str) -> bool:
  lowered = query.lower()
  return any(token in lowered for token in ["result", "results", "grades", "marks", "score"]) and any(token in lowered for token in ["show", "list", "all", "student"])


def _is_affirmative(query: str) -> bool:
  return query.strip().lower() in {"yes", "y", "ok", "okay", "confirm", "proceed", "do it"}


def _last_assistant_message(conversation_history: list[dict]) -> str:
  for item in reversed(conversation_history):
    if item.get("role") == "assistant":
      return str(item.get("content") or "")
  return ""


def _fallback_command(query: str, *, student_id: int | None, timetable_id: int | None, attendance_date: date | None) -> StructuredCommand:
  lowered = query.lower()
  if ("create" in lowered or "add" in lowered) and "subject" in lowered:
    return StructuredCommand(
        action="create_subject",
        student_id=student_id,
        timetable_id=timetable_id,
        date=attendance_date,
        message="Prepare a subject creation command from provided details.",
    )
  if "mark" in lowered and "present" in lowered and "except" in lowered:
    except_part = lowered.split("except", 1)[1]
    return StructuredCommand(
        action="mark_attendance",
        student_id=student_id,
        timetable_id=timetable_id,
        date=attendance_date,
        absent_roll_numbers=_extract_roll_numbers(except_part),
        message="Mark all listed class students present except the supplied roll numbers.",
    )
  if "absent" in lowered and ("today" in lowered or "show" in lowered or "list" in lowered):
    return StructuredCommand(
        action="list_absent",
        student_id=student_id,
        timetable_id=timetable_id,
        date=attendance_date,
        message="List absent students for the selected class and date.",
    )
  if _wants_student_directory(query):
    return StructuredCommand(
        action="list_students",
        student_id=student_id,
        timetable_id=timetable_id,
        date=attendance_date,
        message="List enrolled students visible to the current role.",
    )
  if _wants_departments(query):
    return StructuredCommand(action="list_departments", message="List departments visible to the current role.")
  if _wants_subjects(query):
    return StructuredCommand(action="list_subjects", message="List subjects visible to the current role.")
  if _wants_faculty(query):
    return StructuredCommand(action="list_faculty", message="List faculty visible to the current role.")
  if _wants_timetable(query):
    return StructuredCommand(action="list_timetable", message="List timetable entries visible to the current role.")
  if _wants_holidays(query):
    return StructuredCommand(action="list_holidays", message="List holidays visible to the current role.")
  if _wants_overview(query):
    return StructuredCommand(action="get_overview", message="Show academic overview metrics.")
  if _wants_results(query):
    return StructuredCommand(
        action="list_results",
        student_id=student_id,
        message="List result records for the selected student.",
    )
  if student_id:
    return StructuredCommand(
        action="attendance_summary",
        student_id=student_id,
        timetable_id=timetable_id,
        date=attendance_date,
    )
  return StructuredCommand(action="unsupported", message="Please select a student or class context first.")


async def _build_command(query: str, context: dict, fallback: StructuredCommand) -> StructuredCommand:
  try:
    llm_command = await command_from_hosted_llm(query, context)
  except Exception:  # noqa: BLE001
    llm_command = None
  if not llm_command:
    return fallback
  try:
    return StructuredCommand(**llm_command)
  except ValidationError:
    return fallback


async def _attendance_summary(student_id: int, query: str, auth_header: str | None) -> tuple[str, dict]:
  student = await fetch_student(student_id, auth_header=auth_header)
  history = await fetch_attendance_history(student_id, auth_header=auth_header)
  subject_percentages = build_subject_percentages(history)

  total_classes = len(history)
  attended_classes = sum(1 for item in history if item.get("status") in {"present", "late"})
  overall_percentage = attendance_percentage(attended_classes, total_classes)
  remaining = remaining_classes_for_target(
      attended_classes,
      total_classes,
      settings.ATTENDANCE_TARGET_PERCENT,
  )
  weak_subjects = detect_weak_subjects(
      subject_percentages,
      threshold_percent=settings.ATTENDANCE_TARGET_PERCENT,
  )
  subject_risks = build_subject_risk_map(subject_percentages)

  lowered_query = query.lower()
  if "weak" in lowered_query:
    answer = (
        f"Weak subjects for {student.get('name', 'student')} are: "
        f"{weak_subjects if weak_subjects else 'none'}."
    )
  elif "remaining" in lowered_query or "predict" in lowered_query:
    answer = (
        f"{student.get('name', 'Student')} needs approximately {remaining} more consecutive "
        f"present classes to reach {settings.ATTENDANCE_TARGET_PERCENT:.0f}% attendance."
    )
  else:
    answer = (
        f"{student.get('name', 'Student')} has attended {attended_classes}/{total_classes} "
        f"classes ({overall_percentage}%)."
    )

  metadata = {
      "student_id": student_id,
      "total_classes": total_classes,
      "attended_classes": attended_classes,
      "overall_attendance_percentage": overall_percentage,
      "remaining_classes_to_target": remaining,
      "weak_subject_ids": weak_subjects,
      "subject_percentages": {str(k): v for k, v in subject_percentages.items()},
      "subject_risks": {str(k): v for k, v in subject_risks.items()},
  }
  return answer, metadata


async def _list_absent(command: StructuredCommand, auth_header: str | None) -> tuple[str, dict]:
  if not command.timetable_id or not command.date:
    return "Select a class and date before asking for absent students.", {}
  students = await fetch_class_students(command.timetable_id, auth_header=auth_header)
  attendance = await fetch_class_attendance(command.timetable_id, command.date, auth_header=auth_header)
  students_by_id = {student["id"]: student for student in students}
  absent_students = [
      students_by_id.get(record["student_id"])
      for record in attendance
      if record.get("status") == "absent" and record.get("student_id") in students_by_id
  ]
  absent_students = [student for student in absent_students if student]
  if not absent_students:
    return "No absent students were found for the selected class and date.", {"absent_students": []}
  names = ", ".join(f"{student['roll_number']} - {student['name']}" for student in absent_students)
  return f"Absent students: {names}.", {"absent_students": absent_students}


async def _list_students(query: str, *, auth_header: str | None) -> tuple[str, dict]:
  response = await fetch_students(page=1, page_size=100, auth_header=auth_header)
  items = response.get("items", [])
  total = int(response.get("total", len(items)))
  if not items:
    return "No enrolled students are visible to your current role.", {"students": [], "total": total}
  names = [student.get("name", "Unknown") for student in items]
  preview = ", ".join(names[:25])
  suffix = f" (showing first {min(len(names), 25)} of {total})" if total > 25 else ""
  return f"Enrolled students: {preview}.{suffix}", {"students": items, "total": total}


async def _list_departments(*, auth_header: str | None) -> tuple[str, dict]:
  departments = await fetch_departments(auth_header=auth_header)
  if not departments:
    return "No departments are available.", {"departments": []}
  names = [department.get("name", "Unknown") for department in departments]
  return f"Departments: {', '.join(names[:25])}.", {"departments": departments}


async def _list_subjects(
    *,
    auth_header: str | None,
    department: str | None = None,
    batch_year: int | None = None,
    semester: int | None = None,
) -> tuple[str, dict]:
  subjects = await fetch_subjects(
      department=department,
      batch_year=batch_year,
      semester=semester,
      auth_header=auth_header,
  )
  if not subjects:
    return "No subjects matched the current filters.", {"subjects": []}
  lines = [f"{subject.get('name')} ({subject.get('code') or 'code pending'})" for subject in subjects[:25]]
  return f"Subjects: {', '.join(lines)}.", {"subjects": subjects}


async def _list_faculty(*, auth_header: str | None) -> tuple[str, dict]:
  faculty = await fetch_faculty(auth_header=auth_header)
  if not faculty:
    return "No faculty records are available.", {"faculty": []}
  names = [item.get("name", "Unknown") for item in faculty[:25]]
  return f"Faculty: {', '.join(names)}.", {"faculty": faculty}


async def _list_timetable(
    *,
    auth_header: str | None,
    department: str | None = None,
    batch_year: int | None = None,
    semester: int | None = None,
) -> tuple[str, dict]:
  entries = await fetch_timetable(
      department=department,
      batch_year=batch_year,
      semester=semester,
      auth_header=auth_header,
  )
  if not entries:
    return "No timetable entries matched the current filters.", {"timetable": []}
  lines = [
      f"{entry.get('day')} {entry.get('start_time')} {entry.get('subject_name')}"
      for entry in entries[:20]
  ]
  return f"Timetable entries: {'; '.join(lines)}.", {"timetable": entries}


async def _list_holidays(*, auth_header: str | None) -> tuple[str, dict]:
  holidays = await fetch_holidays(auth_header=auth_header)
  if not holidays:
    return "No holidays are configured.", {"holidays": []}
  lines = [f"{holiday.get('date')} - {holiday.get('description')}" for holiday in holidays[:20]]
  return f"Holidays: {'; '.join(lines)}.", {"holidays": holidays}


async def _get_overview(*, auth_header: str | None) -> tuple[str, dict]:
  overview = await fetch_overview(auth_header=auth_header)
  metrics = overview.get("metrics", {})
  answer = (
      "Overview metrics: "
      f"departments={metrics.get('department_count', 0)}, "
      f"faculty={metrics.get('faculty_count', 0)}, "
      f"students={metrics.get('student_count', 0)}, "
      f"subjects={metrics.get('subject_count', 0)}."
  )
  return answer, {"overview": overview}


async def _list_results(*, student_id: int | None, auth_header: str | None) -> tuple[str, dict]:
  if not student_id:
    return "Please provide or select a student first to list results.", {}
  results = await fetch_student_results(student_id, auth_header=auth_header)
  if not results:
    return "No result records were found for the selected student.", {"results": []}
  lines = [f"{item.get('subject_name')}: {item.get('marks_obtained')}/{item.get('max_marks')} ({item.get('grade')})" for item in results[:20]]
  return f"Results for student {student_id}: {'; '.join(lines)}.", {"results": results}


async def _mark_attendance(command: StructuredCommand, *, execute: bool, auth_header: str | None) -> tuple[str, dict]:
  if not command.timetable_id or not command.date:
    return "Select a class and date before asking me to mark attendance.", {}

  students = await fetch_class_students(command.timetable_id, auth_header=auth_header)
  absent_rolls = {_roll_key(value) for value in command.absent_roll_numbers}
  present_rolls = {_roll_key(value) for value in command.present_roll_numbers}

  records = []
  for student in students:
    roll = _roll_key(student.get("roll_number"))
    if absent_rolls and roll in absent_rolls:
      status_value = "absent"
    elif present_rolls:
      status_value = "present" if roll in present_rolls else "absent"
    else:
      status_value = "present"
    records.append({"student_id": student["id"], "status": status_value})

  summary = {
      "timetable_id": command.timetable_id,
      "date": str(command.date),
      "present_count": sum(1 for record in records if record["status"] == "present"),
      "absent_count": sum(1 for record in records if record["status"] == "absent"),
      "records": records,
  }

  if not execute:
    return (
        f"Prepared attendance for {len(records)} students: "
        f"{summary['present_count']} present and {summary['absent_count']} absent. Submit with execution enabled to save it.",
        summary,
    )

  saved = await mark_bulk_attendance(
      timetable_id=command.timetable_id,
      attendance_date=command.date,
      records=records,
      auth_header=auth_header,
  )
  summary["saved_records"] = len(saved)
  return (
      f"Attendance saved for {len(saved)} students: "
      f"{summary['present_count']} present and {summary['absent_count']} absent.",
      summary,
  )


def _suggest_subject_code(name: str, department: str, semester: int) -> str:
  dept = "".join(ch for ch in department.upper() if ch.isalnum())[:4] or "GEN"
  words = [word for word in re.findall(r"[A-Za-z0-9]+", name.upper()) if word]
  topic = "".join(word[0] for word in words[:3]) or "SUBJ"
  return f"{dept}-S{semester}-{topic}"


async def _create_subject(command: StructuredCommand, *, execute: bool, auth_header: str | None, permissions: list[str]) -> tuple[str, dict]:
  if "subject:manage" not in permissions:
    return "You do not have permission to create subjects (`subject:manage` is required).", {}

  missing_fields = []
  if not command.subject_name:
    missing_fields.append("subject name")
  if not command.department:
    missing_fields.append("department")
  if not command.batch_year:
    missing_fields.append("batch year")
  if not command.semester:
    missing_fields.append("semester")
  if missing_fields:
    return f"I need the following to create the subject: {', '.join(missing_fields)}.", {}

  subject_code = command.subject_code or _suggest_subject_code(command.subject_name, command.department, command.semester)
  payload = {
      "name": command.subject_name,
      "code": subject_code,
      "department": command.department,
      "batch_year": command.batch_year,
      "semester": command.semester,
  }
  if not execute:
    return (
        "Prepared subject creation request. Enable 'Execute allowed commands' and confirm to save it.",
        {"prepared_subject": payload},
    )

  created = await create_subject(
      name=command.subject_name,
      code=subject_code,
      department=command.department,
      batch_year=command.batch_year,
      semester=command.semester,
      auth_header=auth_header,
  )
  return (
      f"Subject created: {created.get('name')} ({created.get('code')}) for {created.get('department')} semester {created.get('semester')}.",
      {"created_subject": created},
  )


async def run_query_chain(
    student_id: int | None,
    query: str,
    auth_header: str | None = None,
    *,
    timetable_id: int | None = None,
    attendance_date: date | None = None,
    execute: bool = False,
    conversation_history: list[dict] | None = None,
) -> tuple[str, StructuredCommand, dict]:
  conversation_history = conversation_history or []
  current_user = await fetch_current_user(auth_header)
  permissions = await fetch_permissions(auth_header)
  class_students = []
  if timetable_id:
    class_students = await fetch_class_students(timetable_id, auth_header=auth_header)

  student = None
  results = None
  students_directory = None
  if student_id:
    try:
      student = await fetch_student(student_id, auth_header=auth_header)
    except Exception:  # noqa: BLE001
      student = None

    if _wants_performance_context(query) or _wants_student_identity(query):
      try:
        results = await fetch_student_results(student_id, auth_header=auth_header)
      except Exception:  # noqa: BLE001
        results = None

  if _wants_student_directory(query):
    try:
      students_directory = await fetch_students(page=1, page_size=100, auth_header=auth_header)
    except Exception:  # noqa: BLE001
      students_directory = None

  context = {
      "user": current_user,
      "permissions": permissions,
      "student_id": student_id,
      "student": student,
      "student_results": results,
      "students_directory": students_directory,
      "timetable_id": timetable_id,
      "date": str(attendance_date) if attendance_date else None,
      "allowed_operations": permissions,
      "class_roll_numbers": [student.get("roll_number") for student in class_students],
      "class_student_count": len(class_students),
      "conversation_history": conversation_history[-12:],
  }

  # Handle common follow-up confirmations safely.
  last_assistant = _last_assistant_message(conversation_history)
  if _is_affirmative(query) and "create the subject" in last_assistant.lower():
    if "subject:manage" not in permissions:
      command = StructuredCommand(action="unsupported", message="Subject creation requires subject:manage permission.")
      return (
          "You do not have permission to create subjects. Please ask an admin to create it, or use a role with `subject:manage`.",
          command,
          {"user_role": current_user.get("role") if current_user else None, "allowed_operations": permissions},
      )
    command = StructuredCommand(action="create_subject", message="Subject creation confirmation captured.")
    return (
        "I captured your confirmation. Please repeat the subject details in one message with department, batch year, and semester, and keep Execute enabled to save.",
        command,
        {"user_role": current_user.get("role") if current_user else None, "allowed_operations": permissions},
    )

  # If the user is asking a general question (not a concrete allowed operation),
  # answer with the hosted model using the available context.
  if _looks_like_general_chat(query):
    llm_answer = await answer_from_hosted_llm(query, context)
    if llm_answer:
      command = StructuredCommand(action="unsupported", message="General assistant response.")
      return llm_answer, command, {"user_role": current_user.get("role") if current_user else None, "allowed_operations": permissions}

  fallback = _fallback_command(query, student_id=student_id, timetable_id=timetable_id, attendance_date=attendance_date)
  command = await _build_command(query, context, fallback)
  if not command.student_id:
    command.student_id = student_id
  if not command.timetable_id:
    command.timetable_id = timetable_id
  if not command.date:
    command.date = attendance_date

  if command.action == "attendance_summary" and command.student_id:
    answer, metadata = await _attendance_summary(command.student_id, query, auth_header)
  elif command.action == "list_departments":
    answer, metadata = await _list_departments(auth_header=auth_header)
  elif command.action == "list_subjects":
    answer, metadata = await _list_subjects(
        auth_header=auth_header,
        department=(student or {}).get("department"),
        batch_year=(student or {}).get("batch_year"),
        semester=(student or {}).get("semester"),
    )
  elif command.action == "list_faculty":
    answer, metadata = await _list_faculty(auth_header=auth_header)
  elif command.action == "list_timetable":
    answer, metadata = await _list_timetable(
        auth_header=auth_header,
        department=(student or {}).get("department"),
        batch_year=(student or {}).get("batch_year"),
        semester=(student or {}).get("semester"),
    )
  elif command.action == "list_holidays":
    answer, metadata = await _list_holidays(auth_header=auth_header)
  elif command.action == "get_overview":
    answer, metadata = await _get_overview(auth_header=auth_header)
  elif command.action == "list_results":
    answer, metadata = await _list_results(student_id=command.student_id or student_id, auth_header=auth_header)
  elif command.action == "list_students":
    answer, metadata = await _list_students(query, auth_header=auth_header)
  elif command.action == "list_absent":
    answer, metadata = await _list_absent(command, auth_header)
  elif command.action == "mark_attendance":
    answer, metadata = await _mark_attendance(command, execute=execute, auth_header=auth_header)
  elif command.action == "create_subject":
    answer, metadata = await _create_subject(command, execute=execute, auth_header=auth_header, permissions=permissions)
  else:
    llm_answer = await answer_from_hosted_llm(query, context)
    answer = llm_answer or command.message or "I could not map that request to an allowed student-management operation."
    metadata = {}

  metadata.update(
      {
          "user_role": current_user.get("role") if current_user else None,
          "allowed_operations": permissions,
          "executed": execute and command.action in {"mark_attendance", "create_subject"},
      },
  )

  try:
    await log_ai_action(
        action=command.action,
        status_value="success",
        command=command.model_dump(mode="json"),
        result=metadata,
        detail=answer,
        auth_header=auth_header,
    )
  except Exception:  # noqa: BLE001
    pass

  return answer, command, metadata
