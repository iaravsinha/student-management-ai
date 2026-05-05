from datetime import date
import json

from pydantic import ValidationError

from app.agents.backend_agent import (
    create_subject,
    fetch_attendance_history,
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
    mark_bulk_attendance,
)
from app.core.config import settings
from app.schemas.assistant import StructuredCommand
from app.services.llm_client import (
    answer_from_hosted_llm, 
    command_from_hosted_llm
)

def _compact_context_for_llm(context: dict) -> dict:
  compact = dict(context)
  fetched = compact.get("fetched_data", {})
  
  # Map subject IDs to names for the LLM
  subjects = fetched.get("subjects", [])
  id_to_subj = {s["id"]: s["name"] for s in subjects if "id" in s and "name" in s}
  
  # Map faculty user IDs to names
  faculty = fetched.get("faculty", [])
  id_to_faculty = {f["user_id"]: f["name"] for f in faculty if "user_id" in f and "name" in f}

  if "attendance" in fetched and isinstance(fetched["attendance"], list):
    for record in fetched["attendance"]:
        sid = record.get("subject_id")
        if sid in id_to_subj:
            record["subject_name"] = id_to_subj[sid]
    fetched["attendance"] = fetched["attendance"][:40]

  if "timetable" in fetched and isinstance(fetched["timetable"], list):
    for entry in fetched["timetable"]:
        fid = entry.get("faculty_user_id")
        if fid in id_to_faculty:
            entry["faculty_name"] = id_to_faculty[fid]
    fetched["timetable"] = fetched["timetable"][:30]

  if "results" in fetched and isinstance(fetched["results"], list):
    fetched["results"] = fetched["results"][:30]

  if isinstance(compact.get("conversation_history"), list):
    compact["conversation_history"] = [
        {"role": str(i.get("role"))[:16], "content": str(i.get("content"))[:250]}
        for i in compact["conversation_history"][-6:]
    ]
  return compact

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
  user = await fetch_current_user(auth_header)
  permissions = await fetch_permissions(auth_header)
  student = await fetch_student(student_id, auth_header) if student_id else None
  
  context = {
      "user": user,
      "student": student,
      "timetable_id": timetable_id,
      "date": str(attendance_date) if attendance_date else None,
      "permissions": permissions,
  }

  cmd_json = await command_from_hosted_llm(query, context)
  
  # Normalize actions if LLM returns objects instead of strings
  if cmd_json and isinstance(cmd_json.get("actions"), list):
    normalized = []
    for a in cmd_json["actions"]:
      if isinstance(a, dict) and "action" in a:
        normalized.append(a["action"])
        # Also merge params if they exist
        if "params" in a and isinstance(a["params"], dict):
            for k, v in a["params"].items():
                if k not in cmd_json or cmd_json[k] is None:
                    cmd_json[k] = v
      elif isinstance(a, str):
        normalized.append(a)
    cmd_json["actions"] = normalized

  command = StructuredCommand(**cmd_json) if cmd_json else StructuredCommand(actions=["unsupported"])
  
  # Ensure IDs are preserved
  command.student_id = command.student_id or student_id
  command.timetable_id = command.timetable_id or timetable_id
  command.date = command.date or attendance_date

  fetched_data = {}
  sid = command.student_id or student_id

  # Ensure master data is available for correlation
  if any(a in {"fetch_attendance", "fetch_results", "fetch_timetable"} for a in command.actions):
    try:
      if "subjects" not in fetched_data:
        fetched_data["subjects"] = await fetch_subjects(auth_header=auth_header)
    except Exception: pass
    try:
      if "faculty" not in fetched_data:
        fetched_data["faculty"] = await fetch_faculty(auth_header=auth_header)
    except Exception: pass
    try:
      if "departments" not in fetched_data:
        fetched_data["departments"] = await fetch_departments(auth_header=auth_header)
    except Exception: pass

  # Map identified actions to pre-made API calls
  for action in command.actions:
    try:
      if action == "fetch_attendance" and sid:
        fetched_data["attendance"] = await fetch_attendance_history(sid, auth_header)
      elif action == "fetch_results" and sid:
        fetched_data["results"] = await fetch_student_results(sid, auth_header)
      elif action == "fetch_timetable":
        dept = command.department or (student or {}).get("department")
        batch = command.batch_year or (student or {}).get("batch_year")
        sem = command.semester or (student or {}).get("semester")
        fetched_data["timetable"] = await fetch_timetable(dept, batch, sem, auth_header)
      elif action == "fetch_directory":
        fetched_data["students"] = await fetch_students(page=1, page_size=100, auth_header=auth_header)
      elif action == "fetch_org_structure":
        fetched_data["departments"] = await fetch_departments(auth_header)
        fetched_data["subjects"] = await fetch_subjects(auth_header=auth_header)
        fetched_data["faculty"] = await fetch_faculty(auth_header)
      elif action == "fetch_overview":
        fetched_data["overview"] = await fetch_overview(auth_header)
      elif action == "mark_attendance":
        # Handled separately if execute is True
        pass
      elif action == "create_subject":
        # Handled separately if execute is True
        pass
    except Exception as e:
      fetched_data[f"error_{action}"] = str(e)

  # Process Write Actions
  if "mark_attendance" in command.actions:
    answer, meta = await _handle_mark_attendance(command, execute, auth_header)
    return answer, command, meta
  
  if "create_subject" in command.actions:
    answer, meta = await _handle_create_subject(command, execute, auth_header, permissions)
    return answer, command, meta

  # Final Step: Pass all fetched data to LLM for a human response
  full_context = {**context, "fetched_data": fetched_data, "conversation_history": conversation_history or []}
  answer = await answer_from_hosted_llm(query, _compact_context_for_llm(full_context))
  
  return answer or "I couldn't process that data.", command, {"fetched_data_keys": list(fetched_data.keys())}

async def _handle_mark_attendance(command: StructuredCommand, execute: bool, auth_header: str | None) -> tuple[str, dict]:
  if not command.timetable_id or not command.date:
    return "Class and date required to mark attendance.", {}
  
  students = await fetch_class_students(command.timetable_id, auth_header=auth_header)
  absent_rolls = {str(r).strip().lower() for r in command.absent_roll_numbers}
  present_rolls = {str(r).strip().lower() for r in command.present_roll_numbers}
  
  records = []
  for s in students:
    roll = str(s.get("roll_number", "")).strip().lower()
    # If present_rolls specified, only those are present. If absent_rolls specified, those are absent.
    # Default is present.
    if present_rolls:
        status = "present" if roll in present_rolls else "absent"
    elif absent_rolls:
        status = "absent" if roll in absent_rolls else "present"
    else:
        status = "present"
    records.append({"student_id": s["id"], "status": status})

  if not execute:
    return f"Prepared attendance for {len(records)} students. Enable 'Execute' to save.", {"records": records}
  
  saved = await mark_bulk_attendance(command.timetable_id, command.date, records, auth_header)
  return f"Successfully marked attendance for {len(saved)} students.", {"saved_count": len(saved)}

async def _handle_create_subject(command: StructuredCommand, execute: bool, auth_header: str | None, permissions: list[str]) -> tuple[str, dict]:
  if "subject:manage" not in permissions:
    return "Permission denied: subject:manage required.", {}
  
  if not command.subject_name or not command.department:
    return "Subject name and department required.", {}

  if not execute:
    return "Subject details prepared. Enable 'Execute' to save.", {"prepared": command.model_dump()}

  created = await create_subject(
      name=command.subject_name,
      code=command.subject_code or "AUTO",
      department=command.department,
      batch_year=command.batch_year or 2024,
      semester=command.semester or 1,
      auth_header=auth_header
  )
  return f"Subject '{created.get('name')}' created successfully.", {"created": created}
