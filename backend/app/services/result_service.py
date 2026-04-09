from sqlalchemy.orm import Session

from app.models.result import ResultRecord
from app.models.user import User
from app.services import student_service


def list_results_for_student(db: Session, *, current_user: User, student_id: int) -> list[ResultRecord]:
  student_service.ensure_student_access(db, current_user, student_id)
  return (
      db.query(ResultRecord)
      .filter(ResultRecord.student_id == student_id)
      .order_by(ResultRecord.subject_name.asc(), ResultRecord.exam_type.asc(), ResultRecord.created_at.desc())
      .all()
  )
