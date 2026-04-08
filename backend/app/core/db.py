from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
  pass


def get_database_url() -> str:
  return (
      f"postgresql+psycopg2://{settings.POSTGRES_USER}:"
      f"{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_HOST}:"
      f"{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
  )


engine = create_engine(get_database_url(), pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
  db = SessionLocal()
  try:
    yield db
  finally:
    db.close()

