from datetime import date
import json


from app.agents.backend_agent import (
    create_subject,
    fetch_attendance_history,
    fetch_class_students,
    fetch_current_user,
    fetch_current_student,
    fetch_current_faculty,
    fetch_departments,
    fetch_faculty,
    fetch_overview,
    fetch_permissions,
    fetch_student,
    fetch_students,
    fetch_student_results,
    fetch_subjects,
    fetch_timetable,
    fetch_sql_query,
    mark_bulk_attendance,
)
from app.schemas.assistant import StructuredCommand
from app.services.llm_client import (
    answer_from_hosted_llm, 
    command_from_hosted_llm
)

def _compact_context_for_llm(context: dict) -> dict:
  compact = dict(context)
  fetched = compact.get("fetched_data", {})
  
  # 0. Pre-extract for mapping
  # 0. Pre-extract for mapping (handle both string and int IDs)
  subjects = fetched.get("subjects", [])
  if not subjects:
      import logging
      logger = logging.getLogger("ai-service")
      logger.warning(f"No subjects found in fetched_data. Keys present: {list(fetched.keys())}")
  
  id_to_subj = {}
  for s in subjects:
      if "id" in s and "name" in s:
          id_to_subj[str(s["id"])] = s["name"]
          id_to_subj[int(s["id"])] = s["name"]

  faculty = fetched.get("faculty", [])
  id_to_faculty = {}
  for f in faculty:
      fid = f.get("user_id") or f.get("id")
      if fid and f.get("name"):
          id_to_faculty[str(fid)] = f["name"]
          id_to_faculty[int(fid)] = f["name"]

  # 1. Identify subjects with active data to prune the master list
  active_subj_ids = set()
  if isinstance(fetched.get("attendance"), list):
      active_subj_ids.update(r.get("subject_id") for r in fetched["attendance"] if r.get("subject_id"))
  if isinstance(fetched.get("results"), list):
      active_subj_ids.update(r.get("subject_id") for r in fetched["results"] if r.get("subject_id"))

  if "subjects" in fetched and isinstance(fetched["subjects"], list):
      filtered_subjects = subjects
      
      # If student profile exists, prioritize their current subjects
      student_profile = compact.get("student")
      if student_profile and student_profile.get("department"):
          dept = student_profile.get("department")
          batch = student_profile.get("batch_year")
          sem = student_profile.get("semester")
          filtered_subjects = [
              s for s in subjects 
              if s.get("department") == dept and s.get("batch_year") == batch and s.get("semester") == sem
          ]
          # If pruning by current semester leaves nothing, fall back to active subjects (from history)
          if not filtered_subjects and active_subj_ids:
              filtered_subjects = [s for s in subjects if s.get("id") in active_subj_ids]
      elif active_subj_ids:
          filtered_subjects = [s for s in subjects if s.get("id") in active_subj_ids]

      fetched["subjects"] = [{"id": s.get("id"), "name": s.get("name")} for s in filtered_subjects][:40]

  if "faculty" in fetched and isinstance(fetched["faculty"], list):
      fetched["faculty"] = [{"id": f.get("id"), "name": f.get("name")} for f in fetched["faculty"]][:10]
  
  if "departments" in fetched:
      del fetched["departments"]

  # 2. Results Summary
  if "results" in fetched and isinstance(fetched["results"], list):
      res_summary = {}
      for r in fetched["results"]:
          name = r.get("subject_name") or id_to_subj.get(r.get("subject_id"), "Unknown Subject")
          if name not in res_summary:
              res_summary[name] = []
          res_summary[name].append({
              "assessment": r.get('assessment_name', 'Exam'),
              "score": f"{r.get('marks_obtained')}/{r.get('max_marks')}",
              "grade": r.get('grade'),
              "subject": name
          })
      fetched["result_summary"] = res_summary
      # Prune raw results
      for r in fetched["results"]:
          r["subject_name"] = id_to_subj.get(r.get("subject_id"), "Unknown Subject")
          for k in ["created_at", "updated_at", "remarks", "student_id"]:
              r.pop(k, None)
      fetched["results"] = fetched["results"][:20]

  # 2. Process attendance records
  if "attendance" in fetched and isinstance(fetched["attendance"], list):
    stats = {}
    for record in fetched["attendance"]:
        sid = record.get("subject_id")
        name = id_to_subj.get(sid, f"Subject {sid}")
        record["subject_name"] = name
        
        if name not in stats:
            stats[name] = {"total": 0, "present": 0}
        stats[name]["total"] += 1
        if record.get("status") in {"present", "late"}: 
            stats[name]["present"] += 1
            
        for k in ["created_at", "updated_at", "remarks", "student_id"]:
            record.pop(k, None)
    
    fetched["attendance_summary"] = {
        name: {
            "percentage": f"{int(s['present']/s['total']*100)}%",
            "attended": s["present"],
            "total": s["total"],
            "display": f"{int(s['present']/s['total']*100)}% ({s['present']}/{s['total']})"
        }
        for name, s in stats.items()
    }
    fetched["attendance"] = fetched["attendance"][:30]

  # 3. Process timetable
  if "timetable" in fetched and isinstance(fetched["timetable"], list):
    for entry in fetched["timetable"]:
        sid = entry.get("subject_id")
        entry["subject_name"] = id_to_subj.get(sid, f"Subject {sid}")
        fid = entry.get("faculty_user_id")
        if fid in id_to_faculty:
            entry["faculty_name"] = id_to_faculty[fid]
        for k in ["created_at", "updated_at"]:
            entry.pop(k, None)
    fetched["timetable"] = fetched["timetable"][:20]

  # 5. Prune history
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
  
  student = None
  faculty_profile = None
  
  if user:
    role = user.get("role")
    if role == "student":
      try:
        student = await fetch_current_student(auth_header)
        if student:
          student_id = student.get("id")
      except Exception:
        pass
    elif role == "teacher":
      try:
        faculty_profile = await fetch_current_faculty(auth_header)
      except Exception:
        pass

  if not student and student_id:
    try:
      student = await fetch_student(student_id, auth_header)
    except Exception:
      pass
  
  context = {
      "user": user,
      "student": student,
      "faculty_profile": faculty_profile,
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

  # Safeguard: If the LLM mistakenly returns the user's account ID as the student_id, 
  # correct it to the actual student profile ID found in the context.
  if student and user and command.student_id == user.get("id") and student.get("id") != user.get("id"):
      command.student_id = student.get("id")

  fetched_data = {}
  
  # MANDATORY: Always fetch mapping data to ensure IDs are converted to names
  try:
    subjects_list = await fetch_subjects(auth_header=auth_header)
    fetched_data["subjects"] = subjects_list
  except Exception as e:
    import logging
    logger = logging.getLogger("ai-service")
    logger.error(f"Mapping fetch (subjects) failed: {e}")
  
  try:
    faculty_list = await fetch_faculty(auth_header=auth_header)
    fetched_data["faculty"] = faculty_list
  except Exception as e:
    import logging
    logger = logging.getLogger("ai-service")
    logger.error(f"Mapping fetch (faculty) failed: {e}")

  sid = command.student_id or student_id

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
      elif action == "execute_sql":
        from app.services.llm_client import sql_query_from_hosted_llm
        sql_query = await sql_query_from_hosted_llm(query, context)
        if sql_query:
          sql_clean = sql_query.replace("```sql", "").replace("```", "").strip()
          fetched_data["sql_query"] = sql_clean
          fetched_data["sql_results"] = await fetch_sql_query(sql_clean, auth_header)
    except Exception as e:
      fetched_data[f"error_{action}"] = str(e)

  # Process Write Actions
  has_fetch = any(a.startswith("fetch_") for a in command.actions)
  
  if "mark_attendance" in command.actions and (not has_fetch or execute):
    answer, meta = await _handle_mark_attendance(command, execute, auth_header, user)
    return answer, command, meta
  
  if "create_subject" in command.actions and (not has_fetch or execute):
    answer, meta = await _handle_create_subject(command, execute, auth_header, permissions)
    return answer, command, meta

  # Final Step: Pass all fetched data to LLM for a human response
  full_context = {**context, "fetched_data": fetched_data, "conversation_history": conversation_history or []}
  from app.chains.query_chain import _compact_context_for_llm
  import logging
  logger = logging.getLogger("ai-service")
  
  compact_context = _compact_context_for_llm(full_context)
  logger.info(f"Final LLM Context (compact): {json.dumps(compact_context, indent=2)}")
  
  answer = await answer_from_hosted_llm(query, compact_context)
  
  return answer or "I couldn't process that data.", command, {"fetched_data_keys": list(fetched_data.keys())}

async def _handle_mark_attendance(command: StructuredCommand, execute: bool, auth_header: str | None, user: dict | None = None) -> tuple[str, dict]:
  if not command.timetable_id:
    if user and user.get("role") == "teacher":
      try:
        from app.agents.backend_agent import fetch_sql_query
        sql = f"SELECT timetable.id, subjects.name as subject_name, timetable.day, timetable.start_time, timetable.end_time FROM timetable JOIN subjects ON timetable.subject_id = subjects.id WHERE timetable.faculty_user_id = {user.get('id')}"
        entries = await fetch_sql_query(sql, auth_header)
        if entries and len(entries) > 0:
          options = "\n".join([f"- **Slot ID {e['id']}**: {e['subject_name']} ({e['day']}s, {e['start_time']} - {e['end_time']})" for e in entries])
          return (
              "Please specify which class slot you want to mark attendance for. "
              f"Here are your scheduled classes:\n\n{options}\n\n"
              f"You can say: *'mark all present for slot ID {entries[0]['id']} on {command.date or 'today'}'*",
              {}
          )
      except Exception:
        pass
    return "Class required to mark attendance. Please specify which subject or timetable slot.", {}

  if not command.date:
    return "Date required to mark attendance. Please specify a date (e.g. 'today' or '6th may').", {}
  
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
