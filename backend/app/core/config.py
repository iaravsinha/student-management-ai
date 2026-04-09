from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
  model_config = SettingsConfigDict(
      env_file=".env",
      env_file_encoding="utf-8",
      case_sensitive=True,
      extra="ignore",
  )

  APP_NAME: str = "Student Management API"
  APP_VERSION: str = "1.0.0"
  ENVIRONMENT: str = "development"
  DEBUG: bool = False

  BACKEND_HOST: str = "0.0.0.0"
  BACKEND_PORT: int = 8000

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
      return [origin.strip() for origin in value.split(",") if origin.strip()]
    return value


@lru_cache
def get_settings() -> Settings:
  return Settings()


settings = get_settings()

