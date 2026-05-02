from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_active_user
from app.core.db import get_db
from app.core.config import settings
from app.core.permissions import Operation, permissions_for_role, require_permission
from app.core.rate_limit import InMemoryRateLimiter
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserRole
from app.schemas.student import StudentCreate
from app.services import audit_service, faculty_service, student_service
from app.schemas.auth import (
    AdminCreateUserRequest,
    BootstrapAdminRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter()
login_rate_limiter = InMemoryRateLimiter(
    max_requests=settings.LOGIN_RATE_LIMIT_COUNT,
    window_seconds=settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    key_prefix="auth-login",
)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> User:
  raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Self registration is disabled. Contact an administrator.",
  )


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    payload: AdminCreateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Operation.AUTH_USER_CREATE)),
) -> User:
  existing_user = db.query(User).filter(User.email == payload.email).first()
  if existing_user:
    raise HTTPException(status_code=400, detail="Email already registered")
  if payload.role == UserRole.student and (not payload.full_name or not payload.department or payload.batch_year is None or payload.semester is None):
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Student creation requires full_name, department, batch_year, and semester",
    )
  if payload.role == UserRole.teacher and (not payload.full_name or not payload.department):
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Teacher creation requires full_name and department",
    )

  user = User(
      email=payload.email,
      password_hash=hash_password(payload.password),
      role=payload.role,
      is_active=payload.is_active,
  )
  db.add(user)
  db.commit()
  db.refresh(user)
  if payload.role == UserRole.student:
    student_service.create_student(
        db,
        StudentCreate(
            name=payload.full_name,
            department=payload.department,
            batch_year=payload.batch_year,
            semester=payload.semester,
            email=payload.email,
        ),
    )
  if payload.role == UserRole.teacher:
    faculty_service.create_faculty_profile(
        db,
        user=user,
        full_name=payload.full_name,
        department=payload.department,
    )
  audit_service.log_action(
      db,
      actor=current_user,
      action="auth:user:create",
      entity_type="user",
      entity_id=user.id,
      meta={"created_role": user.role.value, "created_email": user.email},
  )
  return user


@router.get("/users", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _=Depends(require_permission(Operation.AUTH_USER_READ)),
) -> list[User]:
  return db.query(User).order_by(User.role.asc(), User.email.asc()).all()


@router.post(
    "/bootstrap-admin",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def bootstrap_admin(payload: BootstrapAdminRequest, db: Session = Depends(get_db)) -> User:
  has_admin = db.query(User).filter(User.role == UserRole.admin).first()
  if has_admin:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Bootstrap is disabled after the first admin is created.",
    )

  existing_user = db.query(User).filter(User.email == payload.email).first()
  if existing_user:
    raise HTTPException(status_code=400, detail="Email already registered")

  user = User(
      email=payload.email,
      password_hash=hash_password(payload.password),
      role=UserRole.admin,
      is_active=True,
  )
  db.add(user)
  db.commit()
  db.refresh(user)
  return user


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(login_rate_limiter)])
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
  user = db.query(User).filter(User.email == payload.email).first()
  if not user or not verify_password(payload.password, user.password_hash):
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
    )
  if not user.is_active:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="User is inactive",
    )

  token = create_access_token(subject=user.email, role=user.role.value)
  return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_active_user)) -> User:
  return current_user


@router.get("/permissions", response_model=list[str])
def my_permissions(current_user: User = Depends(get_current_active_user)) -> list[str]:
  return permissions_for_role(current_user.role)
