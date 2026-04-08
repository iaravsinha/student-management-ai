from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Student(Base):
  __tablename__ = "students"

  id: Mapped[int] = mapped_column(primary_key=True, index=True)
  first_name: Mapped[str] = mapped_column(String(100), nullable=False)
  last_name: Mapped[str] = mapped_column(String(100), nullable=False)
  email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
  enrollment_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

