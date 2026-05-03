import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppLayout } from "../components/AppLayout";
import { ActionButton, Badge, EmptyState, PageIntro, SectionCard, StatCard } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { ResultRecord, Student, StudentListResponse, Subject } from "../lib/types";
import { formatDate, getErrorMessage } from "../lib/utils";

const examTypeLabelMap: Record<string, string> = {
  internal: "Internal",
  midterm: "Mid-term",
  final: "Final",
  assignment: "Assignment",
  practical: "Practical",
  viva: "Viva",
};

const gradeColor = (grade: string) => {
  const g = grade.toUpperCase();
  if (g === "O" || g === "A+" || g === "A") return "success";
  if (g === "B+" || g === "B") return "brand";
  if (g === "C" || g === "C+") return "warning";
  return "danger";
};

const ResultsPage = () => {
  const { user } = useAuth();
  const isStudent = user?.role === "student";

  const [lookupStudent, setLookupStudent] = useState<Student | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState("");

  // Load student list for admin/teacher
  useEffect(() => {
    if (isStudent) return;
    setLoadingStudents(true);
    const load = async () => {
      try {
        const res = await api.get<StudentListResponse>("/students", { params: { page: 1, page_size: 200 } });
        setAllStudents(res.data.items);
      } catch (e) {
        setError(getErrorMessage(e, "Unable to load student list"));
      } finally {
        setLoadingStudents(false);
      }
    };
    void load();
  }, [isStudent]);

  // Auto-load student profile for student role
  useEffect(() => {
    if (!isStudent) return;
    setLoadingProfile(true);
    const load = async () => {
      try {
        const res = await api.get<Student>("/students/me");
        setLookupStudent(res.data);
      } catch (e) {
        setError(getErrorMessage(e, "Unable to load your student profile"));
      } finally {
        setLoadingProfile(false);
      }
    };
    void load();
  }, [isStudent]);

  // Load results + subjects when a student is selected
  useEffect(() => {
    if (!lookupStudent) {
      setResults([]);
      setSubjects([]);
      setSelectedSemester(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoadingResults(true);
      setError("");
      try {
        const [resultsRes, subjectsRes] = await Promise.all([
          api.get<ResultRecord[]>(`/results/student/${lookupStudent.id}`),
          api.get<Subject[]>("/subjects", {
            params: { department: lookupStudent.department, batch_year: lookupStudent.batch_year },
          }),
        ]);
        if (!cancelled) {
          setResults(resultsRes.data);
          setSubjects(subjectsRes.data);
          setSelectedSemester(null);
        }
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e, "Unable to load results"));
      } finally {
        if (!cancelled) setLoadingResults(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [lookupStudent]);

  // Build subject ID → semester map
  const subjectSemesterMap = useMemo(() => {
    const map = new Map<number, number>();
    subjects.forEach((s) => map.set(s.id, s.semester));
    // Also use semester from result record if provided by backend
    results.forEach((r) => {
      if (r.semester && !map.has(r.subject_id)) {
        map.set(r.subject_id, r.semester);
      }
    });
    return map;
  }, [subjects, results]);

  // Derive semesters from results (using subject map; fallback to current semester)
  const semesters = useMemo(() => {
    const semSet = new Set<number>();
    results.forEach((r) => {
      const sem = r.semester || subjectSemesterMap.get(r.subject_id);
      if (sem) semSet.add(sem);
    });
    if (semSet.size === 0 && lookupStudent) semSet.add(lookupStudent.semester);
    return Array.from(semSet).sort((a, b) => b - a);
  }, [results, subjectSemesterMap, lookupStudent]);

  const activeSemester = selectedSemester ?? semesters[0] ?? null;

  // Filter results for the active semester
  const semesterResults = useMemo(() => {
    if (!activeSemester) return results;
    return results.filter((r) => (r.semester || subjectSemesterMap.get(r.subject_id)) === activeSemester);
  }, [results, subjectSemesterMap, activeSemester]);

  // Group by subject name within the semester
  const bySubject = useMemo(() => {
    const map = new Map<string, ResultRecord[]>();
    semesterResults.forEach((r) => {
      const list = map.get(r.subject_name) ?? [];
      list.push(r);
      map.set(r.subject_name, list);
    });
    return Array.from(map.entries()).map(([name, recs]) => {
      const totalObtained = recs.reduce((s, r) => s + r.marks_obtained, 0);
      const totalMax = recs.reduce((s, r) => s + r.max_marks, 0);
      const pct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
      return { name, records: recs.sort((a, b) => a.assessment_name.localeCompare(b.assessment_name)), totalObtained, totalMax, pct };
    });
  }, [semesterResults]);

  // Overall stats for active semester
  const semesterStats = useMemo(() => {
    const totalObtained = semesterResults.reduce((s, r) => s + r.marks_obtained, 0);
    const totalMax = semesterResults.reduce((s, r) => s + r.max_marks, 0);
    return {
      assessments: semesterResults.length,
      totalObtained,
      totalMax,
      pct: totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0,
    };
  }, [semesterResults]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.toLowerCase().trim();
    if (!q) return allStudents;
    return allStudents.filter(
      (s) => s.name.toLowerCase().includes(q) || s.enrollment_number.toLowerCase().includes(q),
    );
  }, [allStudents, studentSearch]);

  const clearLookup = () => {
    setLookupStudent(null);
    setStudentSearch("");
    setResults([]);
    setSubjects([]);
    setSelectedSemester(null);
  };

  return (
    <>
      <Head>
        <title>Results | StudentMS</title>
      </Head>
      <AppLayout title="Results">
        <PageIntro
          eyebrow="Academic results"
          title={isStudent ? "Your marks & grades" : "Student results & grades"}
          description={
            isStudent
              ? "View your assessment marks and grades per subject, organised by semester."
              : "Select a student to browse their complete academic results history."
          }
        />

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        {/* Admin / teacher: student picker */}
        {!isStudent ? (
          <SectionCard title="Student lookup" description="Search by name or enrollment number.">
            <div className="space-y-4">
              <div className="flex gap-3">
                <input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search by name or enrollment number..."
                  className="flex-1"
                  disabled={!!lookupStudent}
                />
                {lookupStudent ? (
                  <ActionButton variant="secondary" onClick={clearLookup}>
                    Change student
                  </ActionButton>
                ) : null}
              </div>
              {lookupStudent ? (
                <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-4">
                  <div>
                    <p className="font-semibold text-slate-900">{lookupStudent.name}</p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {lookupStudent.enrollment_number} · {lookupStudent.department} · Batch {lookupStudent.batch_year} · Sem {lookupStudent.semester}
                    </p>
                  </div>
                  <Link
                    href={`/attendance?student_id=${lookupStudent.id}`}
                    className="ml-auto shrink-0 text-sm font-semibold text-cyan-800 hover:underline"
                  >
                    View attendance →
                  </Link>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                  {loadingStudents ? (
                    <p className="px-4 py-4 text-sm text-slate-500">Loading students...</p>
                  ) : filteredStudents.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-slate-500">
                      {allStudents.length === 0 ? "No students found." : "No students match your search."}
                    </p>
                  ) : (
                    filteredStudents.slice(0, 30).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setLookupStudent(s)}
                        className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">{s.name}</p>
                          <p className="text-xs text-slate-500">{s.enrollment_number} · {s.department}</p>
                        </div>
                        <span className="text-xs text-slate-400">Batch {s.batch_year} · Sem {s.semester}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </SectionCard>
        ) : null}

        {/* Student: own profile card */}
        {isStudent && lookupStudent ? (
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Your enrollment</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{lookupStudent.name}</p>
            <p className="mt-1 text-sm text-slate-500">
              {lookupStudent.enrollment_number} · {lookupStudent.department} · Batch {lookupStudent.batch_year} · Semester {lookupStudent.semester}
            </p>
          </div>
        ) : null}

        {isStudent && !lookupStudent && !loadingProfile ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            Loading your profile...
          </div>
        ) : null}

        {!lookupStudent && !isStudent ? (
          <SectionCard title="Results" description="">
            <EmptyState title="No student selected" description="Use the student lookup above to find a student and view their results." />
          </SectionCard>
        ) : null}

        {loadingResults ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            Loading results...
          </div>
        ) : null}

        {!loadingResults && lookupStudent ? (
          <>
            {results.length === 0 ? (
              <SectionCard title="Academic results" description="">
                <EmptyState
                  title="No results recorded"
                  description="Results appear here once teachers or admins enter assessment marks for this student."
                />
              </SectionCard>
            ) : (
              <>
                {/* Semester tab selector */}
                <div className="flex flex-wrap gap-2">
                  {semesters.length > 0 ? (
                    semesters.map((sem) => (
                      <button
                        key={sem}
                        type="button"
                        onClick={() => setSelectedSemester(sem)}
                        className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                          sem === activeSemester
                            ? "border-slate-900 bg-slate-900 text-white shadow-md"
                            : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-slate-900"
                        }`}
                      >
                        Semester {sem}
                        {lookupStudent && sem === lookupStudent.semester ? (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-wide opacity-70">current</span>
                        ) : null}
                      </button>
                    ))
                  ) : (
                    <Badge tone="neutral">No semester data</Badge>
                  )}
                </div>

                {/* Semester summary stats */}
                {semesterStats.assessments > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label={`Semester ${activeSemester ?? ""} assessments`} value={semesterStats.assessments} />
                    <StatCard label="Marks obtained" value={semesterStats.totalObtained} tone="success" />
                    <StatCard label="Total marks" value={semesterStats.totalMax} />
                    <StatCard
                      label="Overall percentage"
                      value={`${semesterStats.pct}%`}
                      tone={semesterStats.pct >= 75 ? "success" : semesterStats.pct >= 50 ? "brand" : "warning"}
                    />
                  </div>
                ) : null}

                {/* Subject-wise results */}
                <div className="space-y-4">
                  {bySubject.map((subject) => (
                    <SectionCard
                      key={subject.name}
                      title={subject.name}
                      description={`${subject.records.length} assessment${subject.records.length !== 1 ? "s" : ""} · ${subject.totalObtained}/${subject.totalMax} marks · ${subject.pct}% overall`}
                    >
                      <div className="overflow-hidden rounded-2xl border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              <th className="px-4 py-3 font-medium">Assessment</th>
                              <th className="px-4 py-3 font-medium hidden sm:table-cell">Type</th>
                              <th className="px-4 py-3 font-medium text-right">Marks</th>
                              <th className="px-4 py-3 font-medium text-center">Grade</th>
                              <th className="px-4 py-3 font-medium hidden md:table-cell">Remarks</th>
                              <th className="px-4 py-3 font-medium hidden md:table-cell">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {subject.records.map((r) => {
                              const pct = r.max_marks > 0 ? Math.round((r.marks_obtained / r.max_marks) * 100) : 0;
                              return (
                                <tr key={r.id} className="hover:bg-slate-50/70">
                                  <td className="px-4 py-3">
                                    <p className="font-medium text-slate-900">{r.assessment_name}</p>
                                    <p className="text-xs text-slate-400 sm:hidden">
                                      {examTypeLabelMap[r.exam_type] ?? r.exam_type}
                                    </p>
                                  </td>
                                  <td className="px-4 py-3 hidden sm:table-cell">
                                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                                      {examTypeLabelMap[r.exam_type] ?? r.exam_type}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right tabular-nums">
                                    <span className={`font-semibold ${pct >= 75 ? "text-emerald-700" : pct >= 50 ? "text-amber-700" : "text-rose-700"}`}>
                                      {r.marks_obtained}
                                    </span>
                                    <span className="text-slate-400">/{r.max_marks}</span>
                                    <p className="text-[11px] text-slate-400">{pct}%</p>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <Badge tone={gradeColor(r.grade)}>{r.grade}</Badge>
                                  </td>
                                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell text-xs">
                                    {r.remarks ?? "—"}
                                  </td>
                                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell text-xs">
                                    {formatDate(r.created_at.split("T")[0])}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {/* Mini progress bar */}
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${subject.pct >= 75 ? "bg-emerald-500" : subject.pct >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                          style={{ width: `${subject.pct}%` }}
                        />
                      </div>
                    </SectionCard>
                  ))}
                </div>
              </>
            )}
          </>
        ) : null}
      </AppLayout>
    </>
  );
};

export default ResultsPage;
