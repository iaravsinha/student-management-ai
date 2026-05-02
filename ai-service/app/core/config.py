from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
  model_config = SettingsConfigDict(
      env_file=".env",
      env_file_encoding="utf-8",
      extra="ignore",
  )

  BACKEND_URL: str = "http://backend:8000"
  BACKEND_API_TOKEN: str | None = None
  REQUEST_TIMEOUT_SECONDS: float = 10.0
  ATTENDANCE_TARGET_PERCENT: float = 75.0
  LLM_PROVIDER: str = "groq"
  LLM_MODEL: str = "llama-3.3-70b-versatile"
  OPENROUTER_API_KEY: str | None = None
  GROQ_API_KEY: str | None = None
  GEMINI_API_KEY: str | None = None
  AI_RATE_LIMIT_COUNT: int = 60
  AI_RATE_LIMIT_WINDOW_SECONDS: int = 60


@lru_cache
def get_settings() -> Settings:
  return Settings()


settings = get_settings()

