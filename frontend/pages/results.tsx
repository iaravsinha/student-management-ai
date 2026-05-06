import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppLayout } from "../components/AppLayout";
import { ActionButton, Badge, EmptyState, PageIntro, SectionCard, StatCard } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { ResultRecord, Student, StudentListResponse, Subject, FacultyProfile } from "../lib/types";
import { formatDate, getErrorMessage } from "../lib/utils";
import { useDepartmentCatalog } from "../lib/useDepartmentCatalog";

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
  const isTeacher = user?.role === "teacher";
  const isAdmin = user?.role === "admin";

  const [teacherProfile, setTeacherProfile] = useState<FacultyProfile | null>(null);
  const [loadingTeacher, setLoadingTeacher] = useState(false);

  // Load department catalog for admins
  const { catalog, loading: loadingCatalog } = useDepartmentCatalog(!isStudent);

  // Dropdown selections
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedClassSemester, setSelectedClassSemester] = useState<string>("");

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

  // 1. Fetch teacher profile if teacher role to restrict department
  useEffect(() => {
    if (!isTeacher) return;
    setLoadingTeacher(true);
    const load = async () => {
      try {
        const res = await api.get<FacultyProfile>("/faculty/me");
        setTeacherProfile(res.data);
        setSelectedDepartment(res.data.department);
      } catch (e) {
        setError(getErrorMessage(e, "Unable to load your faculty profile"));
      } finally {
        setLoadingTeacher(false);
      }
    };
    void load();
  }, [isTeacher]);

  // 2. Fetch students based on role/department
  useEffect(() => {
    if (isStudent) return;
    if (isTeacher && !teacherProfile) return;

    setLoadingStudents(true);
    const load = async () => {
      try {
        const params: Record<string, any> = { page: 1, page_size: 100 };
        if (isTeacher && teacherProfile) {
          params.department = teacherProfile.department;
        } else if (isAdmin && selectedDepartment) {
          params.department = selectedDepartment;
        }
        const res = await api.get<StudentListResponse>("/students", { params });
        setAllStudents(res.data.items);
      } catch (e) {
        setError(getErrorMessage(e, "Unable to load student list"));
      } finally {
        setLoadingStudents(false);
      }
    };
    void load();
  }, [isStudent, isTeacher, teacherProfile, selectedDepartment, isAdmin]);

  // 3. Auto-load student profile for student role
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

  // 4. Load results + subjects when a student is selected
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

  // Compute suggestions based on name typed inside active department
  const nameSuggestions = useMemo(() => {
    const q = studentSearch.toLowerCase().trim();
    if (!q) return [];
    return allStudents.filter(
      (s) => s.name.toLowerCase().includes(q) || s.enrollment_number.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [allStudents, studentSearch]);

  // Filter students based on active dropdown semester selection
  const classStudents = useMemo(() => {
    if (!selectedClassSemester) return [];
    const sem = Number(selectedClassSemester);
    return allStudents
      .filter((s) => s.semester === sem)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allStudents, selectedClassSemester]);

  // Build subject ID → semester map
  const subjectSemesterMap = useMemo(() => {
    const map = new Map<number, number>();
    subjects.forEach((s) => map.set(s.id, s.semester));
    results.forEach((r) => {
      if (r.semester && !map.has(r.subject_id)) {
        map.set(r.subject_id, r.semester);
      }
    });
    return map;
  }, [subjects, results]);

  // Derive semesters from results
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
              : "Locate classes and select students via structured dropdowns and autocomplete lookup."
          }
        />

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        {/* Teacher / Admin Workspace Lookup Panel */}
        {!isStudent ? (
          <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
            {/* Filters and Autocomplete Search */}
            <SectionCard 
              title="Class Directory Filters" 
              description={isTeacher ? "Your access is confined to your registered faculty department." : "Filter students by academic departments and semesters."}
            >
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Department Filter (Dropdown / Locked static badge) */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Department
                    </label>
                    {isTeacher ? (
                      <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 shadow-inner">
                        <span className="mr-1.5">🔒</span> {teacherProfile ? teacherProfile.department : "Loading department..."}
                      </div>
                    ) : (
                      <select
                        value={selectedDepartment}
                        onChange={(e) => {
                          setSelectedDepartment(e.target.value);
                          setLookupStudent(null);
                        }}
                        className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                      >
                        <option value="">Select Department</option>
                        {catalog.map((dept) => (
                          <option key={dept.id} value={dept.name}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Semester Dropdown */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Semester
                    </label>
                    <select
                      value={selectedClassSemester}
                      onChange={(e) => {
                        setSelectedClassSemester(e.target.value);
                      }}
                      className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                    >
                      <option value="">Select Semester</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                        <option key={sem} value={sem}>
                          Semester {sem}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Real-time Autocomplete Name Search */}
                <div className="relative">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Search Student Name or ID
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Type name to view instant suggestions..."
                      className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-4 pr-10 text-sm font-medium text-slate-800 shadow-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                    />
                    {studentSearch && (
                      <button
                        type="button"
                        onClick={() => setStudentSearch("")}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Suggestions List Popover */}
                  {studentSearch.trim() !== "" && (
                    <div className="absolute z-30 mt-1.5 w-full max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl divide-y divide-slate-100">
                      {nameSuggestions.length === 0 ? (
                        <p className="px-4 py-3 text-xs font-medium text-slate-400">
                          No students match this name in your department.
                        </p>
                      ) : (
                        nameSuggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setLookupStudent(s);
                              setStudentSearch("");
                              setSelectedClassSemester(s.semester.toString());
                              if (isAdmin) {
                                setSelectedDepartment(s.department);
                              }
                            }}
                            className="flex w-full items-center justify-between px-4 py-2.5 text-left transition hover:bg-cyan-50/50"
                          >
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                              <p className="text-xs text-slate-400">
                                {s.enrollment_number} · {s.department}
                              </p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                              Sem {s.semester}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* Selected Student Card */}
            <SectionCard title="Active Profile" description="Overview of the currently inspected student record.">
              {lookupStudent ? (
                <div className="flex flex-col h-full justify-between gap-4">
                  <div className="flex gap-4 items-start">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-600 text-white flex items-center justify-center font-bold text-xl shadow-md">
                      {lookupStudent.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-950">{lookupStudent.name}</h4>
                      <p className="text-xs font-semibold text-slate-400 mt-0.5">{lookupStudent.enrollment_number}</p>
                      <p className="text-xs font-medium text-slate-500 mt-1">
                        🏢 {lookupStudent.department} · Batch {lookupStudent.batch_year} · Sem {lookupStudent.semester}
                      </p>
                      <p className="text-xs text-cyan-600 break-all mt-1 font-medium">{lookupStudent.email}</p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-3 border-t border-slate-100 mt-2">
                    <Link
                      href={`/students?student_id=${lookupStudent.id}`}
                      className="flex-1 text-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition"
                    >
                      View Full Profile
                    </Link>
                    <Link
                      href={`/attendance?student_id=${lookupStudent.id}`}
                      className="flex-1 text-center rounded-xl bg-cyan-600 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-700 shadow-md shadow-cyan-600/10 transition"
                    >
                      View Attendance
                    </Link>
                    <ActionButton variant="secondary" onClick={clearLookup}>
                      Change Selection
                    </ActionButton>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <span className="text-2xl mb-2">👤</span>
                  <p className="text-sm font-semibold text-slate-500">No Student Selected</p>
                  <p className="text-xs text-slate-400 max-w-[220px] mt-1">
                    Select a student from suggestions or the class roster to inspect grades.
                  </p>
                </div>
              )}
            </SectionCard>
          </div>
        ) : null}

        {/* Class Roster (Appears once Department + Semester are selected) */}
        {!isStudent && selectedDepartment && selectedClassSemester ? (
          <SectionCard
            title={`Class Roster — Semester ${selectedClassSemester}`}
            description={`Displaying all students registered in the department.`}
          >
            {loadingStudents ? (
              <p className="px-4 py-4 text-sm text-slate-500">Loading student class list...</p>
            ) : classStudents.length === 0 ? (
              <EmptyState
                title="No students found"
                description="There are currently no students registered for this specific department and semester."
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 font-semibold">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">Roll Number</th>
                      <th className="px-5 py-3.5 font-semibold">Student Name</th>
                      <th className="px-5 py-3.5 font-semibold hidden sm:table-cell">Enrollment Code</th>
                      <th className="px-5 py-3.5 font-semibold hidden md:table-cell">Email Address</th>
                      <th className="px-5 py-3.5 font-semibold text-right">Inspection</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {classStudents.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => setLookupStudent(s)}
                        className={`cursor-pointer transition hover:bg-slate-50/80 ${lookupStudent?.id === s.id ? "bg-cyan-50/30" : ""}`}
                      >
                        <td className="px-5 py-3.5 tabular-nums font-bold text-slate-600">
                          {s.roll_number || "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-slate-900">{s.name}</p>
                        </td>
                        <td className="px-5 py-3.5 hidden sm:table-cell font-semibold text-slate-500">
                          {s.enrollment_number}
                        </td>
                        <td className="px-5 py-3.5 hidden md:table-cell text-slate-500">
                          {s.email}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span
                            className={`inline-block rounded-lg px-3 py-1.5 text-xs font-bold transition shadow-sm ${
                              lookupStudent?.id === s.id
                                ? "bg-cyan-600 text-white shadow-cyan-600/10"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            {lookupStudent?.id === s.id ? "Currently Inspecting" : "Inspect Grades"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        ) : null}

        {/* Student View Profile Card */}
        {isStudent && lookupStudent ? (
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-bold">Your enrollment</p>
            <p className="mt-2 text-xl font-bold text-slate-900">{lookupStudent.name}</p>
            <p className="mt-1 text-sm text-slate-500 font-medium">
              {lookupStudent.enrollment_number} · {lookupStudent.department} · Batch {lookupStudent.batch_year} · Semester {lookupStudent.semester}
            </p>
          </div>
        ) : null}

        {isStudent && !lookupStudent && !loadingProfile ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            Loading your profile...
          </div>
        ) : null}

        {/* Initial empty state if nothing selected */}
        {!lookupStudent && !isStudent && !(selectedDepartment && selectedClassSemester) ? (
          <SectionCard title="Grades Sheet" description="">
            <EmptyState 
              title="Class selection required" 
              description="Please choose a department and semester from the filters to browse the class list, or search by student name." 
            />
          </SectionCard>
        ) : null}

        {loadingResults ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            Loading student results ledger...
          </div>
        ) : null}

        {/* Render student results once a student is selected */}
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
                <div className="flex flex-wrap gap-2 mt-2">
                  {semesters.length > 0 ? (
                    semesters.map((sem) => (
                      <button
                        key={sem}
                        type="button"
                        onClick={() => setSelectedSemester(sem)}
                        className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
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
                      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500 font-semibold">
                            <tr>
                              <th className="px-4 py-3 font-semibold">Assessment</th>
                              <th className="px-4 py-3 font-semibold hidden sm:table-cell">Type</th>
                              <th className="px-4 py-3 font-semibold text-right">Marks</th>
                              <th className="px-4 py-3 font-semibold text-center">Grade</th>
                              <th className="px-4 py-3 font-semibold hidden md:table-cell">Remarks</th>
                              <th className="px-4 py-3 font-semibold hidden md:table-cell">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {subject.records.map((r) => {
                              const pct = r.max_marks > 0 ? Math.round((r.marks_obtained / r.max_marks) * 100) : 0;
                              return (
                                <tr key={r.id} className="hover:bg-slate-50/70">
                                  <td className="px-4 py-3">
                                    <p className="font-semibold text-slate-900">{r.assessment_name}</p>
                                    <p className="text-xs text-slate-400 sm:hidden">
                                      {examTypeLabelMap[r.exam_type] ?? r.exam_type}
                                    </p>
                                  </td>
                                  <td className="px-4 py-3 hidden sm:table-cell">
                                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                                      {examTypeLabelMap[r.exam_type] ?? r.exam_type}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right tabular-nums">
                                    <span className={`font-bold ${pct >= 75 ? "text-emerald-700" : pct >= 50 ? "text-amber-700" : "text-rose-700"}`}>
                                      {r.marks_obtained}
                                    </span>
                                    <span className="text-slate-400 font-medium">/{r.max_marks}</span>
                                    <p className="text-[11px] text-slate-400 font-semibold">{pct}%</p>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <Badge tone={gradeColor(r.grade)}>{r.grade}</Badge>
                                  </td>
                                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell text-xs font-medium">
                                    {r.remarks ?? "—"}
                                  </td>
                                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell text-xs font-medium">
                                    {formatDate(r.created_at.split("T")[0])}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {/* Mini progress bar */}
                      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
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
