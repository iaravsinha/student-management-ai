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


@lru_cache
def get_settings() -> Settings:
  return Settings()


settings = get_settings()

