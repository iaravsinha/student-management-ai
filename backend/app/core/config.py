from functools import lru_cache
from typing import List

from pydantic import AnyHttpUrl
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
  BACKEND_HOST: str = "0.0.0.0"
  BACKEND_PORT: int = 8000

  POSTGRES_HOST: str = "postgres"
  POSTGRES_PORT: int = 5432
  POSTGRES_DB: str = "student_management"
  POSTGRES_USER: str = "student_admin"
  POSTGRES_PASSWORD: str = "student_password"

  REDIS_HOST: str = "redis"
  REDIS_PORT: int = 6379
  REDIS_DB: int = 0

  SECRET_KEY: str = "change_me"
  ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

  BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = [AnyHttpUrl("http://localhost:3000")]

  AI_SERVICE_URL: AnyHttpUrl | None = None

  class Config:
    env_file = ".env"
    env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
  return Settings()


settings = get_settings()

