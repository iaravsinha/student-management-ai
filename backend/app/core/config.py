from functools import lru_cache
import json

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
  model_config = SettingsConfigDict(
      env_file=".env",
      env_file_encoding="utf-8",
      case_sensitive=True,
      extra="ignore",
  )

  APP_NAME: str = "EdXplore API"
  APP_VERSION: str = "1.0.0"
  ENVIRONMENT: str = "development"
  DEBUG: bool = False
  AUTO_CREATE_TABLES: bool = False
  BACKEND_API_TOKEN: str | None = None

  BACKEND_HOST: str = "0.0.0.0"
  BACKEND_PORT: int = 8000
  BACKEND_ROOT_PATH: str = ""

  POSTGRES_HOST: str = "db"
  POSTGRES_PORT: int = 5432
  POSTGRES_DB: str = "student_management"
  POSTGRES_USER: str = "student_admin"
  POSTGRES_PASSWORD: str = "student_password"
  DATABASE_URL: str | None = None

  REDIS_HOST: str = "redis"
  REDIS_PORT: int = 6379
  REDIS_DB: int = 0
  REDIS_URL: str | None = None

  JWT_SECRET: str = "change_me_in_production"
  JWT_ALGORITHM: str = "HS256"
  ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
  MIN_PASSWORD_LENGTH: int = 8

  LOGIN_RATE_LIMIT_COUNT: int = 10
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = 60
  REQUEST_RATE_LIMIT_COUNT: int = 240
  REQUEST_RATE_LIMIT_WINDOW_SECONDS: int = 60

  CLASS_DURATION_MINUTES: int = 45
  ATTENDANCE_TARGET_PERCENT: float = 75.0
  UPLOAD_MAX_BYTES: int = 5_000_000

  BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:3000"]

  @property
  def sqlalchemy_database_uri(self) -> str:
    if self.DATABASE_URL:
      return self.DATABASE_URL
    return (
        f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
        f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    )

  @property
  def redis_dsn(self) -> str:
    if self.REDIS_URL:
      return self.REDIS_URL
    return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

  @field_validator("BACKEND_CORS_ORIGINS", mode="before")
  @classmethod
  def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
    if isinstance(value, str):
      raw = value.strip()
      if not raw:
        return []
      # Accept JSON-style lists in env vars, e.g. ["https://a.com","http://localhost:3000"]
      if raw.startswith("[") and raw.endswith("]"):
        try:
          parsed = json.loads(raw)
          if isinstance(parsed, list):
            return [str(origin).strip() for origin in parsed if str(origin).strip()]
        except json.JSONDecodeError:
          # Fall back to comma-separated parsing
          pass
      return [origin.strip().strip('"').strip("'") for origin in raw.split(",") if origin.strip()]
    return value

  @model_validator(mode="after")
  def validate_production_secrets(self) -> "Settings":
    if self.ENVIRONMENT.lower() == "production":
      if self.JWT_SECRET in {"change_me_in_production", "some_long_random_secret"}:
        raise ValueError("JWT_SECRET must be set to a strong production value")
      if len(self.JWT_SECRET) < 32:
        raise ValueError("JWT_SECRET must be at least 32 characters in production")
      if not self.DATABASE_URL:
        raise ValueError("DATABASE_URL is required in production")
    return self


@lru_cache
def get_settings() -> Settings:
  return Settings()


settings = get_settings()

