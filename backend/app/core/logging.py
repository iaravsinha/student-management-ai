import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path


class ServiceNameFilter(logging.Filter):
  def __init__(self, service_name: str):
    super().__init__()
    self.service_name = service_name

  def filter(self, record: logging.LogRecord) -> bool:
    record.service = self.service_name
    return True


def configure_logging(service_name: str = "backend") -> logging.Logger:
  logs_dir = Path("logs")
  logs_dir.mkdir(parents=True, exist_ok=True)

  formatter = logging.Formatter(
      fmt="%(asctime)s | %(service)s | %(levelname)s | %(message)s",
      datefmt="%Y-%m-%d %H:%M:%S",
  )
  service_filter = ServiceNameFilter(service_name)

  console_handler = logging.StreamHandler()
  console_handler.setLevel(logging.INFO)
  console_handler.setFormatter(formatter)
  console_handler.addFilter(service_filter)

  file_handler = RotatingFileHandler(
      logs_dir / f"{service_name}.log",
      maxBytes=5_000_000,
      backupCount=3,
      encoding="utf-8",
  )
  file_handler.setLevel(logging.INFO)
  file_handler.setFormatter(formatter)
  file_handler.addFilter(service_filter)

  logger = logging.getLogger(service_name)
  logger.setLevel(logging.INFO)
  logger.handlers.clear()
  logger.propagate = False
  logger.addHandler(console_handler)
  logger.addHandler(file_handler)
  return logger

