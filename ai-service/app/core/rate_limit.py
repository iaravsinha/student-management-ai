from collections import defaultdict, deque
from time import monotonic

from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
  def __init__(self, *, max_requests: int, window_seconds: int, key_prefix: str):
    self.max_requests = max_requests
    self.window_seconds = window_seconds
    self.key_prefix = key_prefix
    self._hits: dict[str, deque[float]] = defaultdict(deque)

  async def __call__(self, request: Request) -> None:
    now = monotonic()
    client_host = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    if not client_host and request.client:
      client_host = request.client.host
    key = f"{self.key_prefix}:{client_host or 'unknown'}"
    hits = self._hits[key]
    while hits and now - hits[0] > self.window_seconds:
      hits.popleft()
    if len(hits) >= self.max_requests:
      raise HTTPException(
          status_code=status.HTTP_429_TOO_MANY_REQUESTS,
          detail="Too many AI requests. Please try again shortly.",
      )
    hits.append(now)
