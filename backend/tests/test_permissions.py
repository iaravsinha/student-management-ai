from app.core.permissions import Operation, ROLE_PERMISSIONS
from app.models.user import UserRole


def test_admin_has_all_operations() -> None:
  assert Operation.STUDENT_IMPORT in ROLE_PERMISSIONS[UserRole.admin]
  assert Operation.AUDIT_READ in ROLE_PERMISSIONS[UserRole.admin]


def test_teacher_permissions_are_scoped() -> None:
  assert Operation.ATTENDANCE_MARK in ROLE_PERMISSIONS[UserRole.teacher]
  assert Operation.STUDENT_DELETE not in ROLE_PERMISSIONS[UserRole.teacher]


def test_student_permissions_are_read_only_for_attendance() -> None:
  assert Operation.ATTENDANCE_READ in ROLE_PERMISSIONS[UserRole.student]
  assert Operation.ATTENDANCE_MARK not in ROLE_PERMISSIONS[UserRole.student]
