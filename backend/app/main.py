from time import perf_counter

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.analytics_middleware import AnalyticsMiddleware
from app.core.audit_middleware import AuditLoggingMiddleware
from app.core.auth_middleware import TokenValidationMiddleware
from app.core.config import settings
from app.core.database import Base, engine
from app.core.logging import configure_logging
import app.models  # noqa: F401
from app.routes import analytics, audit, attendance, auth, departments, faculty, health, overview, query, results, students, subjects, timetable


logger = configure_logging("backend")


def create_app() -> FastAPI:
  app = FastAPI(
      title=settings.APP_NAME,
      version=settings.APP_VERSION,
      docs_url="/docs",
      redoc_url="/redoc",
      root_path=settings.BACKEND_ROOT_PATH,
      redirect_slashes=False,
  )

  app.add_middleware(
      CORSMiddleware,
      allow_origins=settings.BACKEND_CORS_ORIGINS,
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  app.add_middleware(TokenValidationMiddleware)
  app.add_middleware(AuditLoggingMiddleware)
  # AnalyticsMiddleware is outermost so it captures every request after inner
  # middleware (TokenValidationMiddleware) has populated request.state.token_payload.
  app.add_middleware(AnalyticsMiddleware)

  @app.on_event("startup")
  def ensure_tables_exist() -> None:
    if settings.AUTO_CREATE_TABLES:
      Base.metadata.create_all(bind=engine)

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

  @app.get("/health", tags=["health"])
  def health_check() -> dict[str, str]:
    return {"status": "ok"}

  app.include_router(health.router, prefix="/health", tags=["health"])
  app.include_router(auth.router, prefix="/auth", tags=["auth"])
  app.include_router(audit.router, prefix="/audit", tags=["audit"])
  app.include_router(departments.router, prefix="/departments", tags=["departments"])
  app.include_router(faculty.router, prefix="/faculty", tags=["faculty"])
  app.include_router(overview.router, prefix="/overview", tags=["overview"])
  app.include_router(students.router, prefix="/students", tags=["students"])
  app.include_router(subjects.router, prefix="/subjects", tags=["subjects"])
  app.include_router(results.router, prefix="/results", tags=["results"])
  app.include_router(attendance.router, prefix="/attendance", tags=["attendance"])
  app.include_router(timetable.router, prefix="/timetable", tags=["timetable"])
  app.include_router(query.router, prefix="/query", tags=["query"])
  app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])

  return app


app = create_app()
