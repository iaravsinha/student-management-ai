import json

import httpx

from app.core.config import settings


SYSTEM_PROMPT = """You convert student-management requests into safe JSON commands.
Return only JSON with these keys:
action: attendance_summary | list_departments | list_subjects | list_faculty | list_timetable | list_holidays | get_overview | list_results | list_students | list_absent | mark_attendance | create_subject | unsupported
student_id: number or null
timetable_id: number or null
date: YYYY-MM-DD or null
present_roll_numbers: array of strings
absent_roll_numbers: array of strings
subject_name: string or null
subject_code: string or null
department: string or null
batch_year: number or null
semester: number or null
message: short explanation or null

Never invent permissions or records. If the request cannot be mapped safely, use action unsupported.
"""

CHAT_SYSTEM_PROMPT = """You are a helpful academic assistant for a student-management app.
Use the provided context JSON (user, permissions, known student/class ids, and any fetched aggregates).
If the context lacks necessary data, say so and provide the best next steps or questions to ask.
Be concise, specific, and avoid fabricating records.
"""


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


async def command_from_hosted_llm(query: str, context: dict) -> dict | None:
  url, api_key, model = _provider_config()
  if not api_key:
    return None

  provider = settings.LLM_PROVIDER.lower()
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    if provider == "gemini":
      response = await client.post(
          f"{url}?key={api_key}",
          json={
              "contents": [
                  {
                      "role": "user",
                      "parts": [
                          {
                              "text": (
                                  f"{SYSTEM_PROMPT}\nContext JSON:\n{json.dumps(context)}\n"
                                  f"User query:\n{query}"
                              ),
                          },
                      ],
                  },
              ],
              "generationConfig": {"responseMimeType": "application/json"},
          },
      )
      response.raise_for_status()
      text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
      return json.loads(text)

    response = await client.post(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Context JSON:\n{json.dumps(context)}\nUser query:\n{query}",
                },
            ],
            "response_format": {"type": "json_object"},
        },
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    return json.loads(content)


async def answer_from_hosted_llm(query: str, context: dict) -> str | None:
  url, api_key, model = _provider_config()
  if not api_key:
    return None

  provider = settings.LLM_PROVIDER.lower()
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    if provider == "gemini":
      response = await client.post(
          f"{url}?key={api_key}",
          json={
              "contents": [
                  {
                      "role": "user",
                      "parts": [
                          {
                              "text": (
                                  f"{CHAT_SYSTEM_PROMPT}\nContext JSON:\n{json.dumps(context)}\n"
                                  f"User query:\n{query}"
                              ),
                          },
                      ],
                  },
              ],
          },
      )
      response.raise_for_status()
      return response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()

    response = await client.post(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": CHAT_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Context JSON:\n{json.dumps(context)}\nUser query:\n{query}",
                },
            ],
        },
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"].strip()
