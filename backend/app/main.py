from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routes import health, students


def create_app() -> FastAPI:
  app = FastAPI(
      title="Student Management API",
      version="0.1.0",
      docs_url="/docs",
      redoc_url="/redoc",
  )

  app.add_middleware(
      CORSMiddleware,
      allow_origins=settings.BACKEND_CORS_ORIGINS,
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )

  app.include_router(health.router, prefix="/health", tags=["health"])
  app.include_router(students.router, prefix="/students", tags=["students"])

  return app


app = create_app()

