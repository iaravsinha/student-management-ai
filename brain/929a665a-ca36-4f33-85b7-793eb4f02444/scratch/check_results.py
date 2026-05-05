import os
import sys
from sqlalchemy.orm import Session

# Add backend to path
sys.path.append('d:/student-management-ai-main/backend')

from app.core.database import SessionLocal
from app.models.student import Student
from app.models.result import ResultRecord
from app.models.subject import Subject

def get_weakest_subjects():
    db = SessionLocal()
    try:
        students = db.query(Student).all()
        if not students:
            print("No students found.")
            return

        for student in students:
            print(f"--- Student: {student.name} (ID: {student.id}, Email: {student.email}) ---")
            results = db.query(ResultRecord).filter(ResultRecord.student_id == student.id).all()
            if not results:
                print("  No results found.")
                continue
            
            # Sort by marks_obtained / max_marks
            sorted_results = sorted(results, key=lambda x: (x.marks_obtained / x.max_marks))
            print("  Weakest subjects (lowest marks):")
            for r in sorted_results[:3]:
                percentage = (r.marks_obtained / r.max_marks) * 100
                print(f"    - {r.subject_name}: {r.marks_obtained}/{r.max_marks} ({percentage:.1f}%) Grade: {r.grade}")
            print("\n")

    finally:
        db.close()

if __name__ == "__main__":
    get_weakest_subjects()
