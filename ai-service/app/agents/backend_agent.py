from collections import defaultdict

import httpx

from app.core.config import settings
from app.tools.attendance_tool import attendance_percentage


def _headers(incoming_auth_header: str | None = None) -> dict[str, str]:
  if incoming_auth_header:
    return {"Authorization": incoming_auth_header}
  if not settings.BACKEND_API_TOKEN:
    return {}
  return {"Authorization": f"Bearer {settings.BACKEND_API_TOKEN}"}


async def fetch_student(student_id: int, auth_header: str | None = None) -> dict:
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    response = await client.get(
        f"{settings.BACKEND_URL}/students/{student_id}",
        headers=_headers(auth_header),
    )
    response.raise_for_status()
    return response.json()


async def fetch_attendance_history(student_id: int, auth_header: str | None = None) -> list[dict]:
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    response = await client.get(
        f"{settings.BACKEND_URL}/attendance/student/{student_id}",
        headers=_headers(auth_header),
    )
    response.raise_for_status()
    return response.json()


def build_subject_percentages(history: list[dict]) -> dict[int, float]:
  totals = defaultdict(int)
  attended = defaultdict(int)

  for item in history:
    subject_id = int(item["subject_id"])
    totals[subject_id] += 1
    if item.get("status") == "present":
      attended[subject_id] += 1

  return {
      subject_id: attendance_percentage(attended[subject_id], total)
      for subject_id, total in totals.items()
  }

