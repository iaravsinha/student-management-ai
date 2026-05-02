from datetime import date

from app.chains.query_chain import _fallback_command


def test_fallback_parser_builds_mark_attendance_command() -> None:
  command = _fallback_command(
      "Mark all present except roll 4, 5 and 6",
      student_id=None,
      timetable_id=10,
      attendance_date=date(2026, 5, 2),
  )

  assert command.action == "mark_attendance"
  assert command.timetable_id == 10
  assert command.absent_roll_numbers == ["4", "5", "6"]


def test_fallback_parser_keeps_student_summary_compatibility() -> None:
  command = _fallback_command(
      "Show weak subjects",
      student_id=3,
      timetable_id=None,
      attendance_date=None,
  )

  assert command.action == "attendance_summary"
  assert command.student_id == 3
