from app.agents.backend_agent import (
    build_subject_percentages,
    fetch_attendance_history,
    fetch_student,
)
from app.core.config import settings
from app.tools.attendance_tool import (
    attendance_percentage,
    detect_weak_subjects,
    remaining_classes_for_target,
)
from app.tools.grade_tool import build_subject_risk_map


async def run_query_chain(
    student_id: int,
    query: str,
    auth_header: str | None = None,
) -> tuple[str, dict]:
  student = await fetch_student(student_id, auth_header=auth_header)
  history = await fetch_attendance_history(student_id, auth_header=auth_header)
  subject_percentages = build_subject_percentages(history)

  total_classes = len(history)
  attended_classes = sum(1 for item in history if item.get("status") == "present")
  overall_percentage = attendance_percentage(attended_classes, total_classes)
  remaining = remaining_classes_for_target(
      attended_classes,
      total_classes,
      settings.ATTENDANCE_TARGET_PERCENT,
  )
  weak_subjects = detect_weak_subjects(
      subject_percentages,
      threshold_percent=settings.ATTENDANCE_TARGET_PERCENT,
  )
  subject_risks = build_subject_risk_map(subject_percentages)

  lowered_query = query.lower()
  if "weak" in lowered_query:
    answer = (
        f"Weak subjects for {student.get('name', 'student')} are: "
        f"{weak_subjects if weak_subjects else 'none'}."
    )
  elif "remaining" in lowered_query or "predict" in lowered_query:
    answer = (
        f"{student.get('name', 'Student')} needs approximately {remaining} more consecutive "
        f"present classes to reach {settings.ATTENDANCE_TARGET_PERCENT:.0f}% attendance."
    )
  else:
    answer = (
        f"{student.get('name', 'Student')} has attended {attended_classes}/{total_classes} "
        f"classes ({overall_percentage}%)."
    )

  metadata = {
      "student_id": student_id,
      "total_classes": total_classes,
      "attended_classes": attended_classes,
      "overall_attendance_percentage": overall_percentage,
      "remaining_classes_to_target": remaining,
      "weak_subject_ids": weak_subjects,
      "subject_percentages": {str(k): v for k, v in subject_percentages.items()},
      "subject_risks": {str(k): v for k, v in subject_risks.items()},
  }
  return answer, metadata

