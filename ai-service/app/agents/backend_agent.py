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


async def fetch_current_user(auth_header: str | None = None) -> dict | None:
  if not auth_header:
    return None
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    response = await client.get(
        f"{settings.BACKEND_URL}/auth/me",
        headers=_headers(auth_header),
    )
    response.raise_for_status()
    return response.json()


async def fetch_permissions(auth_header: str | None = None) -> list[str]:
  if not auth_header:
    return []
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    response = await client.get(
        f"{settings.BACKEND_URL}/auth/permissions",
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


async def fetch_student_results(student_id: int, auth_header: str | None = None) -> list[dict]:
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    response = await client.get(
        f"{settings.BACKEND_URL}/results/student/{student_id}",
        headers=_headers(auth_header),
    )
    response.raise_for_status()
    return response.json()


async def fetch_class_students(timetable_id: int, auth_header: str | None = None) -> list[dict]:
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    response = await client.get(
        f"{settings.BACKEND_URL}/students/class/{timetable_id}",
        headers=_headers(auth_header),
    )
    response.raise_for_status()
    return response.json()


async def fetch_students(
    *,
    page: int = 1,
    page_size: int = 100,
    department: str | None = None,
    batch_year: int | None = None,
    auth_header: str | None = None,
) -> dict:
  params: dict[str, int | str] = {"page": page, "page_size": page_size}
  if department:
    params["department"] = department
  if batch_year is not None:
    params["batch_year"] = batch_year
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    response = await client.get(
        f"{settings.BACKEND_URL}/students",
        params=params,
        headers=_headers(auth_header),
    )
    response.raise_for_status()
    return response.json()


async def fetch_departments(auth_header: str | None = None) -> list[dict]:
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    response = await client.get(
        f"{settings.BACKEND_URL}/departments",
        headers=_headers(auth_header),
    )
    response.raise_for_status()
    return response.json()


async def fetch_subjects(
    *,
    department: str | None = None,
    batch_year: int | None = None,
    semester: int | None = None,
    auth_header: str | None = None,
) -> list[dict]:
  params: dict[str, int | str] = {}
  if department:
    params["department"] = department
  if batch_year is not None:
    params["batch_year"] = batch_year
  if semester is not None:
    params["semester"] = semester
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    response = await client.get(
        f"{settings.BACKEND_URL}/subjects",
        params=params,
        headers=_headers(auth_header),
    )
    response.raise_for_status()
    data = response.json()
    import logging
    logger = logging.getLogger("ai-service")
    logger.info(f"Backend Subject API returned {len(data) if isinstance(data, list) else 'non-list'} items")
    return data


async def fetch_faculty(auth_header: str | None = None) -> list[dict]:
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    response = await client.get(
        f"{settings.BACKEND_URL}/faculty",
        headers=_headers(auth_header),
    )
    response.raise_for_status()
    return response.json()


async def fetch_timetable(
    *,
    department: str | None = None,
    batch_year: int | None = None,
    semester: int | None = None,
    auth_header: str | None = None,
) -> list[dict]:
  params: dict[str, int | str] = {}
  if department:
    params["department"] = department
  if batch_year is not None:
    params["batch_year"] = batch_year
  if semester is not None:
    params["semester"] = semester
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    response = await client.get(
        f"{settings.BACKEND_URL}/timetable",
        params=params,
        headers=_headers(auth_header),
    )
    response.raise_for_status()
    return response.json()


async def fetch_holidays(auth_header: str | None = None) -> list[dict]:
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    response = await client.get(
        f"{settings.BACKEND_URL}/timetable/holidays",
        headers=_headers(auth_header),
    )
    response.raise_for_status()
    return response.json()


async def fetch_overview(auth_header: str | None = None) -> dict:
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    response = await client.get(
        f"{settings.BACKEND_URL}/overview/academic",
        headers=_headers(auth_header),
    )
    response.raise_for_status()
    return response.json()


async def fetch_class_attendance(
    timetable_id: int,
    attendance_date,
    auth_header: str | None = None,
) -> list[dict]:
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    response = await client.get(
        f"{settings.BACKEND_URL}/attendance/class/{timetable_id}",
        params={"attendance_date": str(attendance_date)},
        headers=_headers(auth_header),
    )
    response.raise_for_status()
    return response.json()


async def mark_bulk_attendance(
    *,
    timetable_id: int,
    attendance_date,
    records: list[dict],
    auth_header: str | None = None,
) -> list[dict]:
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    response = await client.post(
        f"{settings.BACKEND_URL}/attendance/mark-bulk",
        headers=_headers(auth_header),
        json={
            "timetable_id": timetable_id,
            "date": str(attendance_date),
            "records": records,
        },
    )
    response.raise_for_status()
    return response.json()


async def create_subject(
    *,
    name: str,
    code: str,
    department: str,
    batch_year: int,
    semester: int,
    auth_header: str | None = None,
) -> dict:
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    response = await client.post(
        f"{settings.BACKEND_URL}/subjects/",
        headers=_headers(auth_header),
        json={
            "name": name,
            "code": code,
            "department": department,
            "batch_year": batch_year,
            "semester": semester,
        },
    )
    response.raise_for_status()
    return response.json()


async def fetch_sql_query(query: str, auth_header: str | None = None) -> list[dict]:
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    response = await client.post(
        f"{settings.BACKEND_URL}/query/sql",
        json={"query": query},
        headers=_headers(auth_header),
    )
    response.raise_for_status()
    return response.json()


async def log_ai_action(
    *,
    action: str,
    status_value: str,
    command: dict | None,
    result: dict | None,
    detail: str | None = None,
    auth_header: str | None = None,
) -> None:
  if not auth_header:
    return
  async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
    response = await client.post(
        f"{settings.BACKEND_URL}/audit/ai-action",
        headers=_headers(auth_header),
        json={
            "action": action,
            "status": status_value,
            "detail": detail,
            "command": command,
            "result": result,
        },
    )
    response.raise_for_status()


def build_subject_percentages(history: list[dict]) -> dict[int, float]:
  totals = defaultdict(int)
  attended = defaultdict(int)

  for item in history:
    subject_id = int(item["subject_id"])
    totals[subject_id] += 1
    if item.get("status") in {"present", "late"}:
      attended[subject_id] += 1

  return {
      subject_id: attendance_percentage(attended[subject_id], total)
      for subject_id, total in totals.items()
  }
