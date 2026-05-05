import json
import httpx

from app.core.config import settings


SYSTEM_PROMPT = """Map request to JSON: {"actions": ["action1", "action2"], "student_id": 123, ...}.
Actions: fetch_attendance, fetch_results, fetch_timetable, fetch_directory, fetch_org_structure, fetch_overview, mark_attendance, create_subject.
Note: For 'weak subjects' or 'performance' queries, fetch BOTH fetch_results AND fetch_attendance.
Example: {"actions": ["fetch_attendance", "fetch_results"], "student_id": 1}.
Return ONLY the JSON."""

SQL_PROMPT = """Generate read-only SELECT SQL. Weak subjects: results.grade IN ('C','D','F') OR attendance pct < 75%. Tables: students(id, name, roll_number, email, dept, batch, sem), subjects(id, name, code, dept, batch, sem), results(id, student_id, subject_id, subject_name, marks, max, grade), attendance(id, student_id, subject_id, timetable_id, date, status), timetable(id, subject_id, day, start, end, room, faculty_id). Join on subject_id/student_id. Use student.id from context. Output SQL only."""

CHAT_SYSTEM_PROMPT = "Conversational academic assistant. Use context JSON. Correlate IDs with names. Concise, human sentences. Hide internal logic. No fabrications."


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
      
      response = await client.post(f"{url}?key={api_key}", json=payload)
      response.raise_for_status()
      return response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()

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

    response = await client.post(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=json_payload,
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"].strip()


async def command_from_hosted_llm(query: str, context: dict) -> dict | None:
  content = await call_hosted_llm(SYSTEM_PROMPT, query, context, is_json=True)
  return json.loads(content) if content else None


async def answer_from_hosted_llm(query: str, context: dict) -> str | None:
  return await call_hosted_llm(CHAT_SYSTEM_PROMPT, query, context)


async def sql_query_from_hosted_llm(query: str, context: dict) -> str | None:
  return await call_hosted_llm(SQL_PROMPT, query, context)
