import datetime
import logging
from sqlalchemy.orm import Session

from app.models.student import Student
from app.models.subject import Subject
from app.models.result import ResultRecord
from app.models.attendance import Attendance
from app.models.semantic_document import SemanticDocument
from app.services.embedding_service import embedding_service

logger = logging.getLogger("backend.services.indexing")


class IndexingService:

  async def upsert_student(self, student_id: int, db: Session) -> SemanticDocument | None:
    """Indexes or updates a Student profile in the semantic store."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
      return None

    # Construct clean contextual natural language representation
    title = f"Student Profile: {student.name}"
    content = (
        f"Student Academic Profile: Name: {student.name}, Roll Number: {student.roll_number}, "
        f"Enrollment Number: {student.enrollment_number}, Email Address: {student.email}, "
        f"Enrolled in Department: {student.department}, Batch Year: {student.batch_year}, "
        f"Current Semester: {student.semester}."
    )

    # Generate embedding
    vector = await embedding_service.generate_embedding(content)

    # Prepare role boundaries (Admins and Teachers can view, Student can view if student_id matches)
    metadata = {
        "roles": ["admin", "teacher"],
        "student_id": str(student.id),
        "department": student.department,
    }

    return self._save_document(
        db=db,
        title=title,
        content=content,
        doc_type="student_profile",
        source_table="students",
        source_id=student.id,
        embedding=vector,
        metadata=metadata,
    )

  async def upsert_result(self, result_id: int, db: Session) -> SemanticDocument | None:
    """Indexes or updates an Academic Result record in the semantic store."""
    result = db.query(ResultRecord).filter(ResultRecord.id == result_id).first()
    if not result:
      return None

    student = db.query(Student).filter(Student.id == result.student_id).first()
    student_name = student.name if student else "Unknown Student"
    student_roll = student.roll_number if student else "N/A"

    title = f"Academic Grade Card: {student_name} - {result.subject_name}"
    content = (
        f"Academic Grade / Marksheet Record: Student: {student_name} (Roll: {student_roll}), "
        f"Subject Name: {result.subject_name}, Assessment Type: {result.assessment_name} "
        f"({result.exam_type} Exam), Max Marks possible: {result.max_marks}, "
        f"Marks obtained by Student: {result.marks_obtained}, Final Grade Awarded: {result.grade}. "
        f"Teacher Remarks: {result.remarks or 'No remarks recorded'}."
    )

    vector = await embedding_service.generate_embedding(content)

    metadata = {
        "roles": ["admin", "teacher"],
        "student_id": str(result.student_id),
        "department": student.department if student else "General",
    }

    return self._save_document(
        db=db,
        title=title,
        content=content,
        doc_type="result_data",
        source_table="results",
        source_id=result.id,
        embedding=vector,
        metadata=metadata,
    )

  async def upsert_attendance(self, student_id: int, subject_id: int, db: Session) -> SemanticDocument | None:
    """Generates and indexes/updates an overall attendance summary for a student in a specific subject."""
    student = db.query(Student).filter(Student.id == student_id).first()
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not student or not subject:
      return None

    # Calculate current attendance status count
    records = db.query(Attendance).filter(
        Attendance.student_id == student_id,
        Attendance.subject_id == subject_id
    ).all()

    if not records:
      return None

    total = len(records)
    present = sum(1 for r in records if r.status.value in {"present", "late"})
    percentage = int((present / total) * 100) if total > 0 else 0

    title = f"Attendance Summary: {student.name} - {subject.name}"
    content = (
        f"Academic Attendance Summary: Student Name: {student.name}, Roll: {student.roll_number}, "
        f"Subject Name: {subject.name} (Code: {subject.code or 'N/A'}), Department: {student.department}, "
        f"Total classes marked: {total}, Classes attended: {present}, "
        f"Cumulative attendance percentage: {percentage}% presence."
    )

    vector = await embedding_service.generate_embedding(content)

    metadata = {
        "roles": ["admin", "teacher"],
        "student_id": str(student.id),
        "department": student.department,
    }

    # Use a virtual source_id combining student and subject to prevent row clashes
    virtual_id = student_id * 100000 + subject_id

    return self._save_document(
        db=db,
        title=title,
        content=content,
        doc_type="attendance_record",
        source_table="attendance_summary",
        source_id=virtual_id,
        embedding=vector,
        metadata=metadata,
    )

  def delete_source_document(self, source_table: str, source_id: int, db: Session) -> None:
    """Safely removes an indexed semantic document from the store."""
    db.query(SemanticDocument).filter(
        SemanticDocument.source_table == source_table,
        SemanticDocument.source_id == source_id
    ).delete()
    db.commit()

  def _save_document(
      self,
      db: Session,
      title: str,
      content: str,
      doc_type: str,
      source_table: str | None,
      source_id: int | None,
      embedding: list[float],
      metadata: dict,
  ) -> SemanticDocument:
    # Check if document already exists to perform a clean update/upsert
    existing = None
    if source_table and source_id:
      existing = db.query(SemanticDocument).filter(
          SemanticDocument.source_table == source_table,
          SemanticDocument.source_id == source_id
      ).first()

    if existing:
      existing.title = title
      existing.content = content
      existing.document_type = doc_type
      existing.embedding = embedding
      existing.metadata_ = metadata
      existing.updated_at = datetime.datetime.utcnow()
      db.commit()
      db.refresh(existing)
      return existing
    else:
      doc = SemanticDocument(
          title=title,
          content=content,
          document_type=doc_type,
          source_table=source_table,
          source_id=source_id,
          embedding=embedding,
          metadata_=metadata,
      )
      db.add(doc)
      db.commit()
      db.refresh(doc)
      return doc

  async def reindex_all(self, db: Session) -> dict:
    """Performs global database table scanning and builds fresh semantic vector indexes."""
    # 1. Clear out old database-synced semantic rows
    db.query(SemanticDocument).delete()
    db.commit()

    stats = {
        "students": 0,
        "results": 0,
        "attendance": 0,
        "policies_and_faqs": 0,
    }

    # 2. Index Student Profiles
    students = db.query(Student).all()
    for student in students:
      try:
        await self.upsert_student(student.id, db)
        stats["students"] += 1
      except Exception as e:
        logger.error(f"Failed to index student {student.id}: {e}")

    # 3. Index Results
    results = db.query(ResultRecord).all()
    for result in results:
      try:
        await self.upsert_result(result.id, db)
        stats["results"] += 1
      except Exception as e:
        logger.error(f"Failed to index result {result.id}: {e}")

    # 4. Index Attendance Summaries
    # Fetch distinct student & subject attendance groups
    att_groups = db.query(Attendance.student_id, Attendance.subject_id).distinct().all()
    for student_id, subject_id in att_groups:
      try:
        await self.upsert_attendance(student_id, subject_id, db)
        stats["attendance"] += 1
      except Exception as e:
        logger.error(f"Failed to index attendance summary ({student_id}, {subject_id}): {e}")

    # 5. Pre-seed Rich Institutional Policies, Regulations, Rules & FAQs
    policies = self._get_institutional_policy_seeds()
    for policy in policies:
      try:
        vector = await embedding_service.generate_embedding(policy["content"])
        self._save_document(
            db=db,
            title=policy["title"],
            content=policy["content"],
            doc_type=policy["doc_type"],
            source_table="institutional_seed",
            source_id=policy["source_id"],
            embedding=vector,
            metadata=policy["metadata"],
        )
        stats["policies_and_faqs"] += 1
      except Exception as e:
        logger.error(f"Failed to index policy seed {policy['title']}: {e}")

    return stats

  def _get_institutional_policy_seeds(self) -> list[dict]:
    """Returns seed guidelines, regulations, policies, and FAQs."""
    return [
        {
            "title": "Semester Backlog and Academic Promotion Policy",
            "content": (
                "Official University Policy on Semester Backlogs and Academic Progression: "
                "Students with more than three (3) active semester backlogs across any year "
                "will be subjected to a semester backlog year-back holding rule and will not "
                "be permitted to proceed to the next academic year. Supplying supplementary exams "
                "is mandatory. Supplementary/re-exams are scheduled during semester breaks in July "
                "and December annually. Passing score in supplementary exams is 40%."
            ),
            "doc_type": "policy_document",
            "source_id": 1001,
            "metadata": {"roles": ["admin", "teacher", "student"], "department": "Global"},
        },
        {
            "title": "Exam Malpractice and Disciplinary Regulations",
            "content": (
                "Academic Disciplinary Regulations regarding Exam Malpractices: "
                "Any student found possessing unauthorized notes, smartphone devices, smart watches, "
                "or copying material inside the examination hall will be immediately debarred "
                "from the remaining exams of the semester. The disciplinary committee (disciplinary board) "
                "holds the power to suspend students for up to two semesters, award an F grade in all "
                "registered subjects, or expel the student in extreme malpractice cases."
            ),
            "doc_type": "policy_document",
            "source_id": 1002,
            "metadata": {"roles": ["admin", "teacher", "student"], "department": "Global"},
        },
        {
            "title": "Campus Hostels Late Entry Rules and Timings",
            "content": (
                "Hostel Housing rules and late entry timings policy: "
                "The general curfew time for all campus hostels is 10:00 PM (10:00 PM) on weekdays "
                "and 11:00 PM on weekends. Late entry requests must be submitted online to the Warden "
                "with parent consent at least 4 hours in advance. First-time unauthorized late entry "
                "triggers a warning SMS to parents; repeated violations (3 or more) attract a penalty "
                "fee of $100 and potential suspension from hostel privileges."
            ),
            "doc_type": "policy_document",
            "source_id": 1003,
            "metadata": {"roles": ["admin", "teacher", "student"], "department": "Global"},
        },
        {
            "title": "CSE Department Class Attendance Policy",
            "content": (
                "Computer Science and Engineering (CSE) Department mandatory attendance regulation: "
                "Every student in the CSE department must maintain a minimum threshold of 75% "
                "attendance in both theory and practical classes. Failure to meet the 75% attendance "
                "clause will bar the student from appearing in the End-Semester examinations. Medical "
                "leaves/certificates can waive attendance criteria up to 10% (minimum 65% absolute attendance "
                "remains mandatory for medical concessions)."
            ),
            "doc_type": "policy_document",
            "source_id": 1004,
            "metadata": {"roles": ["admin", "teacher", "student"], "department": "CSE"},
        },
        {
            "title": "Course Grading Scales and CGPA System",
            "content": (
                "Grading and Cumulative Grade Point Average (CGPA) conversion parameters: "
                "Grades are calculated out of 10 points: Grade O (Outstanding) = 10, A+ (Excellent) = 9, "
                "A (Very Good) = 8, B+ (Good) = 7, B (Above Average) = 6, C (Pass) = 5, F (Fail) = 0. "
                "To calculate SGPA (Semester GPA), sum of (Course Credits multiplied by Grade Points) "
                "is divided by total credits. Minimum CGPA required to pass the graduation degree is 5.0."
            ),
            "doc_type": "policy_document",
            "source_id": 1005,
            "metadata": {"roles": ["admin", "teacher", "student"], "department": "Global"},
        },
        {
            "title": "Fee Payment Schedules, Penalty Fees, and Concessions FAQ",
            "content": (
                "Frequently Asked Questions regarding Fee Schedule and Concessions: "
                "Tuition fee invoices are raised on June 1st and November 1st for odd and even semesters. "
                "Late payment beyond 15 days of the due date attracts a flat penalty charge of $50 plus "
                "$5 per additional day. Merit-based fee scholarships/concessions of up to 50% waiver "
                "are awarded to top 5% students in each branch maintaining CGPA greater than 9.0."
            ),
            "doc_type": "faq",
            "source_id": 1006,
            "metadata": {"roles": ["admin", "teacher", "student"], "department": "Global"},
        },
    ]


# Singleton instance
indexing_service = IndexingService()
