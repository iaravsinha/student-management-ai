import json
import httpx
import logging

logger = logging.getLogger("ai-service")

from app.core.config import settings


SYSTEM_PROMPT = """Map request to JSON: {"actions": ["action1", "action2"], "student_id": 123, ...}.
Actions: fetch_attendance (view history), fetch_results (view grades), fetch_timetable, fetch_directory, fetch_org_structure, fetch_overview, mark_attendance (submit new record), create_subject (add new).
CRITICAL:
- Use 'fetch_...' for "show", "view", "what is", or "get" queries.
- Use 'mark_attendance' ONLY if the user is explicitly providing status for specific students/dates to SAVE.
- ONLY list actions explicitly requested. 
- If the user asks "what can you do", "who are you", or general chat, return {"actions": []}.
- Use 'context.student.id' for student_id, NOT 'context.user.id'. 
Return ONLY the JSON."""

SQL_PROMPT = """Generate read-only SELECT SQL. Weak subjects: results.grade IN ('C','D','F') OR attendance pct < 75%. Tables: students(id, name, roll_number, email, dept, batch, sem), subjects(id, name, code, dept, batch, sem), results(id, student_id, subject_id, subject_name, marks, max, grade), attendance(id, student_id, subject_id, timetable_id, date, status), timetable(id, subject_id, day, start, end, room, faculty_id). Join on subject_id/student_id. Use student.id from context. Output SQL only."""

CHAT_SYSTEM_PROMPT = """You are a highly concise Academic Assistant.
- Use context JSON. Prefer 'attendance_summary' and 'result_summary' for data queries.
- ONLY discuss specific subjects that have active records in the provided summaries.
- If asked "what can you do", you can: check attendance/results, view timetables, search the directory, and manage academic records.
- BE MATHEMATICALLY ACCURATE. If a student is already at a target percentage (e.g., 95%), tell them they've reached it.
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
