from sqlalchemy.orm import Session

from app.models.result import ResultRecord
from app.models.subject import Subject
from app.models.user import User
from app.services import student_service


def list_results_for_student(db: Session, *, current_user: User, student_id: int) -> list[ResultRecord]:
  student_service.ensure_student_access(db, current_user, student_id)
  
  # Join with Subject to get the semester
  results = (
      db.query(ResultRecord, Subject.semester)
      .join(Subject, Subject.id == ResultRecord.subject_id)
      .filter(ResultRecord.student_id == student_id)
      .order_by(Subject.semester.desc(), ResultRecord.subject_name.asc(), ResultRecord.exam_type.asc())
      .all()
  )
  
  # Attach semester to the ResultRecord objects (they will be returned as part of the schema)
  output = []
  for record, semester in results:
    record.semester = semester
    output.append(record)
    
  return output
