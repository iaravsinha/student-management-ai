import { FormEvent, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Student, Subject, TimetableEntry, User } from "../../lib/types";
import { getErrorMessage } from "../../lib/utils";
import { ActionButton, Badge, SectionCard } from "../ui";

type ResultManagerProps = {
  user: User;
};

export const ResultManager = ({ user }: ResultManagerProps) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    student_id: "",
    assessment_name: "",
    exam_type: "internal",
    max_marks: 100,
    marks_obtained: 0,
    grade: "A",
    remarks: "",
  });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [subjectsRes, studentsRes] = await Promise.all([
          api.get<Subject[]>("/subjects"),
          api.get<{ items: Student[] }>("/students", { params: { page_size: 1000 } }),
        ]);
        
        if (user.role === "teacher") {
          // Filter subjects based on teacher's timetable
          const timetableRes = await api.get<TimetableEntry[]>("/timetable");
          const teacherSubjectIds = new Set(timetableRes.data.map(t => t.subject_id));
          setSubjects(subjectsRes.data.filter(s => teacherSubjectIds.has(s.id)));
        } else {
          setSubjects(subjectsRes.data);
        }
        setStudents(studentsRes.data.items);
      } catch (e) {
        setError("Failed to load management data");
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId || !form.student_id) return;
    
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/results", {
        ...form,
        subject_id: Number(selectedSubjectId),
        student_id: Number(form.student_id),
      });
      setSuccess("Result uploaded successfully");
      setForm(prev => ({ ...prev, marks_obtained: 0, remarks: "" }));
    } catch (e) {
      setError(getErrorMessage(e, "Failed to upload result"));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSubject = subjects.find(s => s.id === Number(selectedSubjectId));
  const filteredStudents = selectedSubject 
    ? students.filter(s => s.department === selectedSubject.department && s.batch_year === selectedSubject.batch_year)
    : [];

  return (
    <SectionCard title="Upload Result" description="Enter marks for a specific student and subject.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-100">{error}</div>}
        {success && <div className="text-sm text-emerald-600 bg-emerald-50 p-3 rounded-xl border border-emerald-100">{success}</div>}
        
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Subject</label>
            <select 
              value={selectedSubjectId} 
              onChange={(e) => setSelectedSubjectId(e.target.value ? Number(e.target.value) : "")}
              disabled={loading}
            >
              <option value="">Select subject...</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.department} · Sem {s.semester})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Student</label>
            <select 
              value={form.student_id} 
              onChange={(e) => setForm(f => ({ ...f, student_id: e.target.value }))}
              disabled={!selectedSubjectId || loading}
            >
              <option value="">Select student...</option>
              {filteredStudents.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.enrollment_number})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Assessment Name</label>
            <input 
              value={form.assessment_name}
              onChange={(e) => setForm(f => ({ ...f, assessment_name: e.target.value }))}
              placeholder="e.g. Unit Test 1"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Type</label>
            <select value={form.exam_type} onChange={(e) => setForm(f => ({ ...f, exam_type: e.target.value }))}>
              <option value="internal">Internal</option>
              <option value="midterm">Mid-term</option>
              <option value="final">Final</option>
              <option value="assignment">Assignment</option>
              <option value="practical">Practical</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Grade</label>
            <input 
              value={form.grade}
              onChange={(e) => setForm(f => ({ ...f, grade: e.target.value.toUpperCase() }))}
              placeholder="A+, B, O, etc."
              maxLength={2}
              required
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Marks Obtained</label>
            <input 
              type="number"
              value={form.marks_obtained}
              onChange={(e) => setForm(f => ({ ...f, marks_obtained: Number(e.target.value) }))}
              min={0}
              max={form.max_marks}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Max Marks</label>
            <input 
              type="number"
              value={form.max_marks}
              onChange={(e) => setForm(f => ({ ...f, max_marks: Number(e.target.value) }))}
              min={1}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Remarks</label>
          <textarea 
            value={form.remarks}
            onChange={(e) => setForm(f => ({ ...f, remarks: e.target.value }))}
            placeholder="Optional comments..."
            rows={2}
            className="resize-none"
          />
        </div>

        <ActionButton type="submit" disabled={submitting || !selectedSubjectId || !form.student_id}>
          {submitting ? "Uploading..." : "Save Result"}
        </ActionButton>
      </form>
    </SectionCard>
  );
};
