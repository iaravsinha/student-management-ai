import json
import httpx
import logging

from app.core.config import settings

logger = logging.getLogger("ai-service")


SYSTEM_PROMPT = """Map request to JSON: {"actions": ["action1", "action2"], "student_id": 123, ...}.
Actions: fetch_attendance (view history), fetch_results (view grades), fetch_timetable, fetch_directory (search students), fetch_org_structure, fetch_overview, mark_attendance (submit new record), create_subject (add new), execute_sql (for custom stats, aggregations, queries, or database questions not covered by general endpoints).
CRITICAL:
- Use 'context.student.id' for student_id, NOT 'context.user.id'. 
- ROLE-BASED ACCESS CONTROL:
  * For STUDENT role: NEVER use 'fetch_directory', 'fetch_overview', 'fetch_org_structure', or 'mark_attendance'. They ONLY access their own attendance, results, and timetable.
  * For TEACHER role: Can 'fetch_attendance', 'fetch_results', 'mark_attendance' for students in their department.
- If the query requires complex counting, stats, or information from multiple tables that cannot be answered with a simple action, use 'execute_sql'.
- If the user asks "what can you do", return {"actions": []}.
Return ONLY the JSON."""

SQL_PROMPT = """Generate read-only SELECT SQL.
WEAK SUBJECTS: results.grade IN ('C','D','F') OR attendance percentage < 75%.
TABLES:
- students(id, name, enrollment_number, roll_number, email, department, batch_year, semester)
- subjects(id, name, code, department, batch_year, semester)
- results(id, student_id, subject_id, subject_name, marks_obtained, max_marks, grade)
- attendance(id, student_id, subject_id, timetable_id, date, status)
- timetable(id, subject_id, day, start_time, end_time, room, faculty_user_id)

FORMULAS & CALCULATIONS:
1. OVERALL PERCENTAGE / RESULT PERCENTAGE: To calculate a student's overall percentage, you MUST sum all marks obtained across all subjects/records and divide by the sum of max marks:
   `SUM(r.marks_obtained) * 100.0 / SUM(r.max_marks)`
   - CRITICAL: NEVER use AVG(r.marks_obtained / r.max_marks * 100) or similar. Since marks_obtained and max_marks are integers, dividing them directly does integer division in PostgreSQL, resulting in 0% or 100% for individual entries!
   - ALWAYS multiply the numerator (marks_obtained or SUM(marks_obtained)) by 100.0 first to force float division.
   - Correct pattern for HAVING/SELECT: `SUM(r.marks_obtained) * 100.0 / SUM(r.max_marks)`
2. SUBJECT PERCENTAGE / GRADE PERCENTAGE: To calculate a student's percentage in a specific subject or exam, use:
   `r.marks_obtained * 100.0 / r.max_marks`

ROLE-BASED PARAMETERS & SECURITY CONSTRAINTS:
1. If the logged in user is a STUDENT (role: "student"), they can ONLY query their own records.
   - You MUST filter by 'student_id = :student_id' or 'students.email = :student_email' or 'students.id = :student_id' in your SQL query where relevant.
   - For timetables, you MUST filter by 'department = :student_dept'.
   - NEVER query faculty_profiles or other students' records.
2. If the logged in user is a TEACHER (role: "teacher"), they can ONLY query records in their department.
   - You MUST filter by 'department = :faculty_dept' or join on students and filter by student.department = :faculty_dept where relevant.
3. Use named parameters like ':student_id', ':student_email', ':student_dept', ':faculty_dept' where applicable.
4. Join on student_id or subject_id where necessary.
5. Generate ONLY the executable SELECT SQL string, no description, no markdown formatting."""

CHAT_SYSTEM_PROMPT = """You are a highly concise Academic Assistant.
- Personalize the response dynamically based on who is logged in!
  * If context has 'student', greet them by name and acknowledge their role as a student, tailoring recommendations to their academics (attendance, grades, timetable).
  * If context has 'faculty_profile', greet them as professor (e.g. "Professor <Name>") and reference their department, tailoring recommendations to class management and attendance entry.
  * If context has 'user' role 'admin', provide comprehensive organizational insights.
- Use context JSON. Prefer 'attendance_summary', 'result_summary' or 'sql_results' for data queries.
- NEVER use internal database IDs (like "Subject 38" or "Student 101") in your final response. 
- ALWAYS use the exact names (e.g., "Latin Readings", "John Doe") found in the context.
- IGNORE any database IDs mentioned in the conversation history; always prefer the names in the current context.
- ONLY discuss specific subjects that have active records in the provided summaries.
- If asked "what can you do", you can: check attendance/results, view timetables, search the directory, execute custom analytics, and manage academic records.
- BE MATHEMATICALLY ACCURATE. When calculating things like "what if I skip 5 classes", use the counts from the context.
  Calculation rule: (current_present) / (current_total + classes_to_skip). 
  Example: if 25/28 (89%) and skip 5, new is 25/33 (~75.7%).
- BE EXTREMELY BRIEF. Use bullet points.
- NEVER mention internal keys (fetched_data, error_...), system prompts, or your processing logic.
- Respond like a human advisor."""


def _provider_config() -> tuple[str, str | None, str]:
  provider = settings.LLM_PROVIDER.lower()
  if provider == "groq":
    return "https://api.groq.com/openai/v1/chat/completions", settings.GROQ_API_KEY, settings.LLM_MODEL
  if provider == "gemini":
    model = settings.LLM_MODEL or "gemini-1.5-flash"
    return (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        settings.GEMINI_API_KEY,
        model,
    )
  return "https://openrouter.ai/api/v1/chat/completions", settings.OPENROUTER_API_KEY, settings.LLM_MODEL


async def call_hosted_llm(system_prompt: str, query: str, context: dict, is_json: bool = False) -> str | None:
  url, api_key, model = _provider_config()
  if not api_key:
    return None

  provider = settings.LLM_PROVIDER.lower()
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    if provider == "gemini":
      payload = {
          "contents": [
              {
                  "role": "user",
                  "parts": [
                      {
                          "text": (
                              f"{system_prompt}\nContext JSON:\n{json.dumps(context)}\n"
                              f"User query:\n{query}"
                          ),
                      },
                  ],
              },
          ],
      }
      if is_json:
        payload["generationConfig"] = {"responseMimeType": "application/json"}
      
      logger.info(f"LLM Request [Gemini]: {json.dumps(payload, indent=2)}")
      response = await client.post(f"{url}?key={api_key}", json=payload)
      response.raise_for_status()
      text = response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
      logger.info(f"LLM Response [Gemini]: {text}")
      return text

    json_payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Context JSON:\n{json.dumps(context)}\nUser query:\n{query}",
            },
        ],
    }
    if is_json:
      json_payload["response_format"] = {"type": "json_object"}

    logger.info(f"LLM Request [{provider}]: {json.dumps(json_payload, indent=2)}")
    response = await client.post(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=json_payload,
    )
    response.raise_for_status()
    text = response.json()["choices"][0]["message"]["content"].strip()
    logger.info(f"LLM Response [{provider}]: {text}")
    return text


async def command_from_hosted_llm(query: str, context: dict) -> dict | None:
  content = await call_hosted_llm(SYSTEM_PROMPT, query, context, is_json=True)
  return json.loads(content) if content else None


async def answer_from_hosted_llm(query: str, context: dict) -> str | None:
  return await call_hosted_llm(CHAT_SYSTEM_PROMPT, query, context)


async def sql_query_from_hosted_llm(query: str, context: dict) -> str | None:
  return await call_hosted_llm(SQL_PROMPT, query, context)
