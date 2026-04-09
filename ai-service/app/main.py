from time import perf_counter

from fastapi import FastAPI, Request

from app.core.logging import configure_logging
from app.routes import health, assistant

logger = configure_logging("ai-service")


def create_app() -> FastAPI:
  app = FastAPI(
      title="Student AI Assistant Service",
      version="0.1.0",
  )

  app.include_router(health.router, prefix="/health", tags=["health"])
  app.include_router(assistant.router, prefix="/assistant", tags=["assistant"])
  app.include_router(assistant.router, prefix="/ai", tags=["ai"])

  @app.middleware("http")
  async def log_requests(request: Request, call_next):
    start = perf_counter()
    logger.info(f"request {request.method} {request.url.path}")
    try:
      response = await call_next(request)
      elapsed_ms = (perf_counter() - start) * 1000
      level_log = logger.warning if response.status_code >= 400 else logger.info
      level_log(
          f"response {request.method} {request.url.path} "
          f"status={response.status_code} duration_ms={elapsed_ms:.2f}",
      )
      return response
    except Exception as exc:
      elapsed_ms = (perf_counter() - start) * 1000
      logger.error(
          f"error {request.method} {request.url.path} "
          f"duration_ms={elapsed_ms:.2f} detail={exc}",
      )
      raise

  return app


app = create_app()

