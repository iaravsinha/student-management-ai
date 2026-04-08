from fastapi import FastAPI

from app.routes import health, assistant


def create_app() -> FastAPI:
  app = FastAPI(
      title="Student AI Assistant Service",
      version="0.1.0",
  )

  app.include_router(health.router, prefix="/health", tags=["health"])
  app.include_router(assistant.router, prefix="/assistant", tags=["assistant"])

  return app


app = create_app()

