from collections.abc import Callable
from enum import StrEnum

from fastapi import Depends, HTTPException, status

from app.core.auth import get_current_active_user
from app.models.user import User, UserRole


class Operation(StrEnum):
  ANALYTICS_READ = "analytics:read"
  AUTH_USER_CREATE = "auth:user:create"
  AUTH_USER_READ = "auth:user:read"
  AUDIT_READ = "audit:read"
  AI_ACTION_CREATE = "ai:action:create"
  DEPARTMENT_READ = "department:read"
  DEPARTMENT_MANAGE = "department:manage"
  FACULTY_READ = "faculty:read"
  OVERVIEW_READ = "overview:read"
  STUDENT_CREATE = "student:create"
  STUDENT_READ = "student:read"
  STUDENT_UPDATE = "student:update"
  STUDENT_DELETE = "student:delete"
  STUDENT_IMPORT = "student:import"
  SUBJECT_READ = "subject:read"
  SUBJECT_MANAGE = "subject:manage"
  RESULT_READ = "result:read"
  ATTENDANCE_READ = "attendance:read"
  ATTENDANCE_MARK = "attendance:mark"
  TIMETABLE_READ = "timetable:read"
  TIMETABLE_MANAGE = "timetable:manage"
  HOLIDAY_MANAGE = "holiday:manage"


ROLE_PERMISSIONS: dict[UserRole, set[Operation]] = {
  UserRole.admin: set(Operation),
  UserRole.teacher: {
      Operation.AI_ACTION_CREATE,
      Operation.DEPARTMENT_READ,
      Operation.FACULTY_READ,
      Operation.OVERVIEW_READ,
      Operation.STUDENT_CREATE,
      Operation.STUDENT_READ,
      Operation.STUDENT_UPDATE,
      Operation.SUBJECT_READ,
      Operation.RESULT_READ,
      Operation.ATTENDANCE_READ,
      Operation.ATTENDANCE_MARK,
      Operation.TIMETABLE_READ,
  },
  UserRole.student: {
      Operation.AI_ACTION_CREATE,
      Operation.DEPARTMENT_READ,
      Operation.OVERVIEW_READ,
      Operation.STUDENT_READ,
      Operation.SUBJECT_READ,
      Operation.RESULT_READ,
      Operation.ATTENDANCE_READ,
      Operation.TIMETABLE_READ,
  },
}


def has_permission(user: User, operation: Operation) -> bool:
  return operation in ROLE_PERMISSIONS.get(user.role, set())


def require_permission(operation: Operation) -> Callable:
  def permission_dependency(current_user: User = Depends(get_current_active_user)) -> User:
    if not has_permission(current_user, operation):
      raise HTTPException(
          status_code=status.HTTP_403_FORBIDDEN,
          detail="Insufficient permissions",
      )
    return current_user

  return permission_dependency


def permissions_for_role(role: UserRole) -> list[str]:
  return sorted(operation.value for operation in ROLE_PERMISSIONS.get(role, set()))
