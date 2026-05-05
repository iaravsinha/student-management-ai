from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Any
import re

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.student import Student
from app.models.faculty import FacultyProfile
from app.core.auth import get_current_user

router = APIRouter()

class SQLQuery(BaseModel):
    query: str

def validate_sql_rbac(query_str: str, role: UserRole, student_profile: Student | None, faculty_profile: FacultyProfile | None) -> tuple[bool, str]:
    q = query_str.lower()
    
    # 1. Block access to highly sensitive tables completely
    blocked_tables = ["users", "audit_logs", "faculty_profiles"] if role == UserRole.student else ["users", "audit_logs"]
    for bt in blocked_tables:
        if re.search(rf"\b{bt}\b", q):
            return False, f"Access to table '{bt}' is prohibited for your role."
            
    # 2. Strict checks for Student role
    if role == UserRole.student:
        if not student_profile:
            return False, "Student profile required to validate queries."
            
        # Check students table
        if re.search(r"\bstudents\b", q):
            # Must contain student_id or email or literal equivalents
            has_id_filter = "student_id" in q or "id" in q or str(student_profile.id) in q
            has_email_filter = "email" in q or student_profile.email.lower() in q
            if not (has_id_filter or has_email_filter):
                return False, "For safety, students can only query their own student profile record."
                
        # Check results table
        if re.search(r"\bresults\b", q):
            if "student_id" not in q and str(student_profile.id) not in q:
                return False, "Students can only query results containing their own student_id."
                
        # Check attendance table
        if re.search(r"\battendance\b", q):
            if "student_id" not in q and str(student_profile.id) not in q:
                return False, "Students can only query attendance containing their own student_id."
                
        # Check timetable table
        if re.search(r"\btimetable\b", q):
            if "dept" not in q and "department" not in q and student_profile.department.lower() not in q:
                return False, f"Students can only query the timetable for their department '{student_profile.department}'."
                
    # 3. Strict checks for Teacher role
    elif role == UserRole.teacher:
        if not faculty_profile:
            return False, "Faculty profile required to validate queries."
            
        # Teachers can query student/results/attendance but must be limited to their department
        for t in ["students", "attendance", "results", "timetable"]:
            if re.search(rf"\b{t}\b", q):
                dept_str = faculty_profile.department.lower()
                # Check if department is filtered or mentioned
                if "dept" not in q and "department" not in q and dept_str not in q:
                    return False, f"Teachers can only query academic data belonging to their department '{faculty_profile.department}'."

    return True, ""

@router.post("/sql")
async def execute_sql(
    payload: SQLQuery,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> list[dict[str, Any]]:
    query = payload.query
    
    # Restrict to SELECT queries for safety
    if not query.strip().upper().startswith("SELECT"):
        raise HTTPException(status_code=400, detail="Only SELECT queries are allowed.")

    # Fetch profile to perform role-based filtering checks
    student_profile = None
    faculty_profile = None
    if current_user.role == UserRole.student:
        student_profile = db.query(Student).filter(Student.email == current_user.email).first()
    elif current_user.role == UserRole.teacher:
        faculty_profile = db.query(FacultyProfile).filter(FacultyProfile.user_id == current_user.id).first()

    # Perform SQL RBAC validation
    is_valid, err_msg = validate_sql_rbac(query, current_user.role, student_profile, faculty_profile)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=err_msg)

    # Build query parameter dictionary dynamically
    params = {}
    if current_user.role == UserRole.student and student_profile:
        params["student_id"] = student_profile.id
        params["student_email"] = student_profile.email
        params["student_dept"] = student_profile.department
        params["student_batch"] = student_profile.batch_year
        params["student_semester"] = student_profile.semester
    elif current_user.role == UserRole.teacher and faculty_profile:
        params["faculty_dept"] = faculty_profile.department

    try:
        result = db.execute(text(query), params)
        # Convert to list of dicts
        return [dict(row._mapping) for row in result]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Query execution failed: {str(e)}")
