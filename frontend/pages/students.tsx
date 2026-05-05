import Head from "next/head";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { AppLayout } from "../components/AppLayout";
import { ActionButton, Badge, EmptyState, Notice, PageIntro, SectionCard, StatCard } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { getDepartmentOption } from "../lib/academic";
import { api } from "../lib/api";
import { useDepartmentCatalog } from "../lib/useDepartmentCatalog";
import {
  AttendanceRecord,
  FacultyProfile,
  ResultRecord,
  Student,
  StudentListResponse,
  StudentPayload,
  Subject,
  TimetableEntry,
} from "../lib/types";
import { formatDate, formatTime, getErrorMessage } from "../lib/utils";

const createEmptyStudentForm = (department = "", batchYear = new Date().getFullYear(), semester = 1): StudentPayload => ({
  name: "",
  department,
  batch_year: batchYear,
  semester,
  email: "",
});

const StudentsPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { catalog, fallbackDepartment, loading: departmentsLoading, error: departmentsError } = useDepartmentCatalog(
    true,
  );
  const isStudentUser = user?.role === "student";
  const canEdit = user?.role === "admin" || user?.role === "teacher";
  const canDelete = user?.role === "admin";
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [batchYearFilter, setBatchYearFilter] = useState<number | "">("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedDepartment, setAppliedDepartment] = useState<string>("");
  const [appliedBatchYear, setAppliedBatchYear] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [panelMode, setPanelMode] = useState<"create" | "edit" | null>(null);
  const [formState, setFormState] = useState<StudentPayload>(createEmptyStudentForm());
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [resultRecords, setResultRecords] = useState<ResultRecord[]>([]);
  const [studentSchedule, setStudentSchedule] = useState<TimetableEntry[]>([]);
  const [studentSubjects, setStudentSubjects] = useState<Subject[]>([]);
  const [facultyProfiles, setFacultyProfiles] = useState<FacultyProfile[]>([]);
  const [profileTab, setProfileTab] = useState<"overview" | "subjects" | "results">("overview");
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedResultSemester, setSelectedResultSemester] = useState<number | "all">("all");

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / 10)), [total]);
  const selectedDepartmentConfig = useMemo(
    () => getDepartmentOption(catalog, formState.department) || fallbackDepartment,
    [catalog, fallbackDepartment, formState.department],
  );
  const filterDepartmentConfig = useMemo(
    () => getDepartmentOption(catalog, departmentFilter) || fallbackDepartment,
    [catalog, departmentFilter, fallbackDepartment],
  );
  const attendanceSummary = useMemo(() => {
    const summary = new Map<string, { total: number; present: number; late: number; absent: number }>();
    attendanceHistory.forEach((record) => {
      const current = summary.get(String(record.subject_id)) || { total: 0, present: 0, late: 0, absent: 0 };
      current.total += 1;
      current[record.status] += 1;
      summary.set(String(record.subject_id), current);
    });
    return summary;
  }, [attendanceHistory]);
  const subjectById = useMemo(() => new Map(studentSubjects.map((subject) => [subject.id, subject])), [studentSubjects]);
  const resultSemesters = useMemo(() => {
    const semesters = Array.from(
      new Set(
        resultRecords
          .map((record) => subjectById.get(record.subject_id)?.semester)
          .filter((semester): semester is number => typeof semester === "number"),
      ),
    );
    return semesters.sort((left, right) => left - right);
  }, [resultRecords, subjectById]);
  const filteredResults = useMemo(
    () =>
      selectedResultSemester === "all"
        ? resultRecords
        : resultRecords.filter((record) => subjectById.get(record.subject_id)?.semester === selectedResultSemester),
    [resultRecords, selectedResultSemester, subjectById],
  );
  const latestResults = useMemo(() => filteredResults.slice(0, 12), [filteredResults]);
  const uniqueSubjects = useMemo(() => {
    const bySubject = new Map<number, { subjectId: number; subjectName: string; facultyName: string; classesPerWeek: number; subject?: Subject }>();
    studentSubjects.forEach((subject) => {
      bySubject.set(subject.id, {
        subjectId: subject.id,
        subjectName: subject.name,
        facultyName: "Faculty pending",
        classesPerWeek: 0,
        subject,
      });
    });
    studentSchedule.forEach((entry) => {
      const facultyName = facultyProfiles.find((profile) => profile.user_id === entry.faculty_user_id)?.name || "Faculty pending";
      const current = bySubject.get(entry.subject_id) || {
        subjectId: entry.subject_id,
        subjectName: entry.subject_name,
        facultyName,
        classesPerWeek: 0,
        subject: subjectById.get(entry.subject_id),
      };
      current.classesPerWeek += 1;
      current.facultyName = facultyName;
      bySubject.set(entry.subject_id, current);
    });
    return Array.from(bySubject.values());
  }, [facultyProfiles, studentSchedule, studentSubjects, subjectById]);
  const selectedSubjectProfile = useMemo(
    () => uniqueSubjects.find((subject) => subject.subjectId === selectedSubjectId) || uniqueSubjects[0] || null,
    [selectedSubjectId, uniqueSubjects],
  );
  const selectedSubjectAttendance = useMemo(
    () =>
      selectedSubjectProfile
        ? attendanceHistory
            .filter((record) => record.subject_id === selectedSubjectProfile.subjectId)
            .slice()
            .sort((left, right) => right.date.localeCompare(left.date))
        : [],
    [attendanceHistory, selectedSubjectProfile],
  );

  useEffect(() => {
    if (!fallbackDepartment) return;
    setFormState((current) =>
      current.department
        ? current
        : createEmptyStudentForm(
            fallbackDepartment.name,
            fallbackDepartment.batches[0],
            fallbackDepartment.semesters[0],
          ),
    );
    if (!router.isReady || isStudentUser) {
      setDepartmentFilter((current) => current || fallbackDepartment.name);
      setAppliedDepartment((current) => current || fallbackDepartment.name);
      return;
    }
    const qDept = router.query.department;
    const qBatch = router.query.batch_year;
    const dept = typeof qDept === "string" && qDept.trim().length > 0 ? qDept : fallbackDepartment.name;
    setDepartmentFilter(dept);
    setAppliedDepartment(dept);
    if (typeof qBatch === "string" && qBatch.trim().length > 0) {
      const year = Number(qBatch);
      if (!Number.isNaN(year)) {
        setBatchYearFilter(year);
        setAppliedBatchYear(year);
      }
    }
  }, [fallbackDepartment, router.isReady, router.query.department, router.query.batch_year, isStudentUser]);

  const loadStudentDetails = async (student: Student | null) => {
    if (!student) {
      setAttendanceHistory([]);
      setResultRecords([]);
      setStudentSchedule([]);
      setStudentSubjects([]);
      setFacultyProfiles([]);
      setDetailError("");
      return;
    }
    setDetailLoading(true);
    setDetailError("");
    try {
      const [attendanceResponse, resultsResponse, timetableResponse, subjectsResponse, facultyResponse] = await Promise.all([
        api.get<AttendanceRecord[]>(`/attendance/student/${student.id}`),
        api.get<ResultRecord[]>(`/results/student/${student.id}`),
        api.get<TimetableEntry[]>("/timetable", {
          params: {
            department: student.department,
            batch_year: student.batch_year,
            semester: student.semester,
          },
        }),
        api.get<Subject[]>("/subjects", {
          params: {
            department: student.department,
            batch_year: student.batch_year,
          },
        }),
        canEdit ? api.get<FacultyProfile[]>("/faculty") : Promise.resolve({ data: [] as FacultyProfile[] }),
      ]);
      setAttendanceHistory(attendanceResponse.data);
      setResultRecords(resultsResponse.data);
      setStudentSchedule(timetableResponse.data);
      setStudentSubjects(subjectsResponse.data);
      setFacultyProfiles(facultyResponse.data);
      setSelectedSubjectId((current) => current && subjectsResponse.data.some((subject) => subject.id === current) ? current : subjectsResponse.data[0]?.id ?? timetableResponse.data[0]?.subject_id ?? null);
      setSelectedResultSemester((current) =>
        current === "all" || subjectsResponse.data.some((subject) => subject.semester === current) ? current : "all",
      );
    } catch (loadError) {
      setDetailError(getErrorMessage(loadError, "Unable to load the student profile details"));
    } finally {
      setDetailLoading(false);
    }
  };

  const loadStudents = async (
    nextPage = page,
    enrollmentNumber = appliedSearch,
    department = appliedDepartment,
    batchYear = appliedBatchYear,
  ) => {
    setLoading(true);
    setError("");
    setDetailError("");
    try {
      const response = isStudentUser
        ? { data: { items: [await api.get<Student>("/students/me").then((result) => result.data)], total: 1, page: 1, page_size: 10 } }
        : await api.get<StudentListResponse>("/students", {
            params: {
              page: nextPage,
              page_size: 10,
              enrollment_number: enrollmentNumber || undefined,
              department: department || undefined,
              batch_year: batchYear || undefined,
            },
          });
      setStudents(response.data.items);
      setTotal(response.data.total);
      setPage(response.data.page);
      const firstStudent = response.data.items[0] ?? null;
      setSelectedStudent(firstStudent);
      await loadStudentDetails(firstStudent);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load students"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isStudentUser) {
      void loadStudents(1, "", "", undefined);
      return;
    }
    if (!fallbackDepartment || !router.isReady) {
      return;
    }
    const dept = appliedDepartment || fallbackDepartment.name;
    void loadStudents(1, appliedSearch, dept, appliedBatchYear);
  }, [isStudentUser, fallbackDepartment, router.isReady, appliedDepartment, appliedBatchYear, appliedSearch]);

  const openCreatePanel = () => {
    setFormState({
      ...createEmptyStudentForm(
        appliedDepartment || fallbackDepartment?.name || "",
        appliedBatchYear || fallbackDepartment?.batches[0] || new Date().getFullYear(),
        fallbackDepartment?.semesters[0] || 1,
      ),
    });
    setPanelMode("create");
    setFeedback("");
  };

  const openEditPanel = (student: Student) => {
    setSelectedStudent(student);
    setFormState({
      name: student.name,
      department: student.department,
      batch_year: student.batch_year,
      semester: student.semester,
      email: student.email,
      roll_number: student.roll_number || undefined,
    });
    setPanelMode("edit");
    setFeedback("");
  };

  const closePanel = () => {
    setPanelMode(null);
    setFormState(
      createEmptyStudentForm(
        fallbackDepartment?.name || "",
        fallbackDepartment?.batches[0] || new Date().getFullYear(),
        fallbackDepartment?.semesters[0] || 1,
      ),
    );
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedSearch(search);
    setAppliedDepartment(departmentFilter);
    setAppliedBatchYear(batchYearFilter || undefined);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFeedback("");

    try {
      if (panelMode === "create") {
        await api.post<Student>("/students", formState);
        setFeedback("Student created successfully. Enrollment number assigned automatically.");
      }
      if (panelMode === "edit" && selectedStudent) {
        await api.put<Student>(`/students/${selectedStudent.id}`, formState);
        setFeedback("Student updated successfully.");
      }
      closePanel();
      await loadStudents(page, appliedSearch, appliedDepartment, appliedBatchYear);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Unable to save student changes"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (student: Student) => {
    const confirmed = window.confirm(`Delete ${student.name} (${student.enrollment_number})?`);
    if (!confirmed) {
      return;
    }

    setError("");
    setFeedback("");
    try {
      await api.delete(`/students/${student.id}`);
      setFeedback("Student deleted successfully.");
      const nextPage = students.length === 1 && page > 1 ? page - 1 : page;
      await loadStudents(nextPage, appliedSearch, appliedDepartment, appliedBatchYear);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Unable to delete student"));
    }
  };

  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
    await loadStudentDetails(student);
  };

  return (
    <>
      <Head>
        <title>{isStudentUser ? "My Profile" : "Students"} | StudentMS</title>
      </Head>
      <AppLayout title={isStudentUser ? "My Profile" : "Students"} actions={canEdit ? <ActionButton onClick={openCreatePanel}>Add student</ActionButton> : null}>
        <PageIntro
          eyebrow={isStudentUser ? "Student profile" : "Student directory"}
          title={isStudentUser ? "Your personal academic profile" : "Student records in one place"}
          description={
            isStudentUser
              ? "Your account is limited to your own student profile, attendance, schedule, and academic support tools."
              : "Search by enrollment number, department, and batch to manage students through a department-first workflow, then click a student to open the academic profile."
          }
          actions={canEdit ? <ActionButton onClick={openCreatePanel}>Add student</ActionButton> : null}
        />

        {departmentsError ? <Notice tone="danger">{departmentsError}</Notice> : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {detailError ? <Notice tone="danger">{detailError}</Notice> : null}
        {feedback ? <Notice tone="success">{feedback}</Notice> : null}

        {departmentsLoading ? (
          <SectionCard title="Loading student workspace" description="Fetching live department, batch, and semester options.">
            <p className="text-sm text-slate-500">Preparing the student directory and profile tools...</p>
          </SectionCard>
        ) : !fallbackDepartment && !isStudentUser ? (
          <SectionCard title="Departments required" description="Student management depends on the academic structure from the backend.">
            <EmptyState
              title="Create a department first"
              description="Once at least one department exists, the student directory can filter, create, and organize records around real academic groups."
            />
          </SectionCard>
        ) : (
        <>

        <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <SectionCard
            title={isStudentUser ? "My record" : "Directory"}
            description={isStudentUser ? "Only your own student record is visible to your account." : "Use the structured filters to browse students by department and batch."}
            actions={
              !isStudentUser ? (
                <form onSubmit={handleSearch} className="grid w-full gap-2 sm:grid-cols-4">
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Enrollment number" />
                  <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
                    {catalog.map((department) => (
                      <option key={department.id} value={department.name}>{department.name}</option>
                    ))}
                  </select>
                  <select value={String(batchYearFilter)} onChange={(event) => setBatchYearFilter(event.target.value ? Number(event.target.value) : "")}>
                    <option value="">All batches</option>
                    {(filterDepartmentConfig?.batches || []).map((batch) => (
                      <option key={batch} value={batch}>{batch} batch</option>
                    ))}
                  </select>
                  <ActionButton type="submit">Apply filters</ActionButton>
                </form>
              ) : null
            }
          >
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Enrollment number</th>
                    <th className="px-4 py-3 font-medium">Department</th>
                    <th className="px-4 py-3 font-medium">Batch</th>
                    <th className="px-4 py-3 font-medium">Semester</th>
                    {canEdit ? <th className="px-4 py-3 font-medium">Actions</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {loading ? <tr><td className="px-4 py-8 text-slate-500" colSpan={canEdit ? 6 : 5}>Loading students...</td></tr> : null}
                  {!loading && students.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8" colSpan={canEdit ? 6 : 5}>
                        <EmptyState title="No students found" description="Adjust the department and batch filters or add the first student record if your role allows it." />
                      </td>
                    </tr>
                  ) : null}
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <button type="button" onClick={() => void handleSelectStudent(student)} className="text-left font-semibold text-slate-900 hover:text-brand-700">{student.name}</button>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{student.enrollment_number}</td>
                      <td className="px-4 py-4 text-slate-600">{student.department}</td>
                      <td className="px-4 py-4 text-slate-600">{student.batch_year}</td>
                      <td className="px-4 py-4 text-slate-600">{student.semester}</td>
                      {canEdit ? (
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <ActionButton variant="secondary" onClick={() => openEditPanel(student)}>Edit</ActionButton>
                            {canDelete ? <ActionButton variant="danger" onClick={() => void handleDelete(student)}>Delete</ActionButton> : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">{isStudentUser ? "Only your own student record is available." : `Page ${page} of ${totalPages} | ${total} total students`}</p>
              {!isStudentUser ? (
                <div className="flex gap-2">
                  <ActionButton variant="secondary" disabled={page <= 1 || loading} onClick={() => void loadStudents(page - 1, appliedSearch, appliedDepartment, appliedBatchYear)}>Previous</ActionButton>
                  <ActionButton variant="secondary" disabled={page >= totalPages || loading} onClick={() => void loadStudents(page + 1, appliedSearch, appliedDepartment, appliedBatchYear)}>Next</ActionButton>
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title={isStudentUser ? "My academic profile" : "Student academic profile"} description={isStudentUser ? "Your details, attendance, results, and weekly teaching context." : "Click a student to load attendance, results, and the weekly academic profile."}>
            {selectedStudent ? (
              <div className="space-y-6">
                <div>
                  <p className="text-2xl font-semibold tracking-tight text-slate-950">{selectedStudent.name}</p>
                  <p className="mt-1 text-sm text-slate-500">Enrollment number {selectedStudent.enrollment_number}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Department</p><p className="mt-2 text-base font-semibold text-slate-900">{selectedStudent.department}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Batch</p><p className="mt-2 text-base font-semibold text-slate-900">{selectedStudent.batch_year}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Semester</p><p className="mt-2 text-base font-semibold text-slate-900">{selectedStudent.semester}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Email</p><p className="mt-2 break-all text-base font-semibold text-slate-900">{selectedStudent.email}</p></div>
                </div>

                {detailLoading ? (
                  <p className="rounded-xl border border-cyan-200/80 bg-cyan-50/90 px-4 py-3 text-sm font-medium text-cyan-900">
                    Refreshing attendance, results, and timetable…
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                  {([
                    ["overview", "Overview"],
                    ["subjects", "Subjects"],
                    ["results", "Results"],
                  ] as const).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setProfileTab(tab)}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        profileTab === tab ? "bg-white text-cyan-800 shadow-sm" : "text-slate-600 hover:bg-white/70"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <>
                  <div className={`grid gap-4 md:grid-cols-3 ${profileTab === "overview" ? "" : "hidden"}`}>
                    <StatCard label="Attendance entries" value={attendanceHistory.length} />
                    <StatCard label="Result records" value={resultRecords.length} />
                    <StatCard label="Weekly classes" value={studentSchedule.length} />
                  </div>

                  <div className={`space-y-3 ${profileTab === "subjects" ? "" : "hidden"}`}>
                    <h3 className="text-base font-semibold text-slate-950">Subject and faculty map</h3>
                    {uniqueSubjects.length === 0 ? (
                      <EmptyState title="No timetable assigned" description="No scheduled class slots were found for this student's batch and semester." />
                    ) : null}
                    {uniqueSubjects.map((subject) => (
                      <button
                        key={`${subject.subjectId}-${subject.subjectName}`}
                        type="button"
                        onClick={() => setSelectedSubjectId(subject.subjectId)}
                        className={`w-full rounded-2xl border p-4 text-left transition hover:border-cyan-200 hover:bg-cyan-50/40 ${
                          selectedSubjectProfile?.subjectId === subject.subjectId ? "border-cyan-300 bg-cyan-50/70" : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{subject.subjectName}</p>
                            <p className="mt-1 text-sm text-slate-500">Faculty: {subject.facultyName} | Semester {subject.subject?.semester ?? selectedStudent.semester}</p>
                          </div>
                          <Badge tone="brand">{subject.classesPerWeek} classes/week</Badge>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className={`space-y-4 rounded-2xl border border-slate-200 bg-white p-5 ${profileTab === "subjects" && selectedSubjectProfile ? "" : "hidden"}`}>
                    {selectedSubjectProfile ? (
                      <>
                        <div>
                          <h3 className="text-base font-semibold text-slate-950">{selectedSubjectProfile.subjectName}</h3>
                          <p className="mt-1 text-sm text-slate-500">Assigned faculty: {selectedSubjectProfile.facultyName}</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Syllabus</p>
                          <p className="mt-2 whitespace-pre-line rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                            {selectedSubjectProfile.subject?.syllabus || "No syllabus has been added for this subject yet."}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Date-wise attendance</p>
                          {selectedSubjectAttendance.length === 0 ? (
                            <p className="mt-2 text-sm text-slate-500">No attendance has been marked for this subject yet.</p>
                          ) : (
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              {selectedSubjectAttendance.map((record) => (
                                <div key={record.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                  <span className="text-sm font-semibold text-slate-800">{formatDate(record.date)}</span>
                                  <Badge tone={record.status === "present" ? "success" : record.status === "late" ? "warning" : "danger"}>{record.status}</Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>

                  <div className={`space-y-3 ${profileTab === "subjects" ? "" : "hidden"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-slate-950">Attendance overview</h3>
                      {user?.role === "admin" ? (
                        <button
                          type="button"
                          onClick={() => void router.push(`/attendance?student_id=${selectedStudent!.id}`)}
                          className="text-sm font-semibold text-cyan-700 hover:underline"
                        >
                          Full view →
                        </button>
                      ) : null}
                    </div>
                    {attendanceHistory.length === 0 ? (
                      <EmptyState title="No attendance yet" description="Attendance records will appear here once classes start getting marked." />
                    ) : null}
                    {Array.from(attendanceSummary.entries()).map(([subjectId, summary]) => {
                      const subjectName =
                        studentSchedule.find((entry) => String(entry.subject_id) === subjectId)?.subject_name ||
                        latestResults.find((item) => String(item.subject_id) === subjectId)?.subject_name ||
                        `Subject ${subjectId}`;
                      const percentage = summary.total ? Math.round(((summary.present + summary.late) / summary.total) * 100) : 0;
                      return (
                        <div key={subjectId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{subjectName}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                Present {summary.present} | Late {summary.late} | Absent {summary.absent}
                              </p>
                            </div>
                            <Badge tone={percentage >= 75 ? "success" : percentage >= 60 ? "warning" : "danger"}>{percentage}% attendance</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className={`space-y-3 ${profileTab === "results" ? "" : "hidden"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-slate-950">Historic results</h3>
                      <select
                        value={String(selectedResultSemester)}
                        onChange={(event) => setSelectedResultSemester(event.target.value === "all" ? "all" : Number(event.target.value))}
                        className="w-auto min-w-[160px]"
                      >
                        <option value="all">All semesters</option>
                        {resultSemesters.map((semester) => (
                          <option key={semester} value={semester}>Semester {semester}</option>
                        ))}
                      </select>
                    </div>
                    {latestResults.length === 0 ? (
                      <EmptyState title="No result records yet" description="Sample or live assessments will appear here once result data is available." />
                    ) : null}
                    {latestResults.length > 0 ? (
                      <div className="overflow-hidden rounded-2xl border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              <th className="px-4 py-3 font-medium">Subject</th>
                              <th className="px-4 py-3 font-medium">Semester</th>
                              <th className="px-4 py-3 font-medium">Assessment</th>
                              <th className="px-4 py-3 font-medium">Marks</th>
                              <th className="px-4 py-3 font-medium">Grade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 bg-white">
                            {latestResults.map((record) => (
                              <tr key={record.id}>
                                <td className="px-4 py-4 text-slate-700">{record.subject_name}</td>
                                <td className="px-4 py-4 text-slate-700">Sem {subjectById.get(record.subject_id)?.semester ?? "-"}</td>
                                <td className="px-4 py-4 text-slate-700">{record.assessment_name}</td>
                                <td className="px-4 py-4 text-slate-700">
                                  {record.marks_obtained}/{record.max_marks}
                                </td>
                                <td className="px-4 py-4">
                                  <Badge
                                    tone={
                                      record.grade.startsWith("A")
                                        ? "success"
                                        : record.grade.startsWith("B")
                                          ? "brand"
                                          : record.grade === "C"
                                            ? "warning"
                                            : "danger"
                                    }
                                  >
                                    {record.grade}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>

                  <div className={`space-y-3 ${profileTab === "overview" ? "" : "hidden"}`}>
                    <h3 className="text-base font-semibold text-slate-950">Weekly schedule</h3>
                    {studentSchedule.length === 0 ? (
                      <EmptyState
                        title="No weekly schedule available"
                        description="The weekly timetable planner has not assigned class slots for this student's batch yet."
                      />
                    ) : null}
                    {studentSchedule.length > 0 ? (
                      <div className="space-y-3">
                        {studentSchedule.slice(0, 10).map((entry) => (
                          <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-900">{entry.subject_name}</p>
                                <p className="mt-1 text-sm text-slate-500">
                                  {entry.day} | {formatTime(entry.start_time)} to {formatTime(entry.end_time)}
                                </p>
                              </div>
                              <Badge>{entry.room ? `Room ${entry.room}` : "Room pending"}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </>
              </div>
            ) : <EmptyState title="Choose a student" description="Select a record from the directory to open the academic profile here." />}
          </SectionCard>
        </section>

        {panelMode ? (
          <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/30 p-4 backdrop-blur-sm">
            <div className="h-full w-full max-w-xl overflow-y-auto rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600">{panelMode === "create" ? "Create student" : "Edit student"}</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{panelMode === "create" ? "Add a new student record" : "Update student information"}</h2>
                  {panelMode === "create" ? <p className="mt-2 text-sm text-slate-500">Enrollment number will be assigned automatically based on department and batch.</p> : null}
                </div>
                <button type="button" onClick={closePanel} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600">Close</button>
              </div>

              <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                <input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} placeholder="Full name" />
                <select value={formState.department} onChange={(event) => {
                  const department = event.target.value;
                  const config = getDepartmentOption(catalog, department) || fallbackDepartment;
                  if (!config) {
                    return;
                  }
                  setFormState((current) => ({
                    ...current,
                    department,
                    batch_year: config.batches[0],
                    semester: config.semesters[0],
                  }));
                }}>
                  {catalog.map((department) => (
                    <option key={department.id} value={department.name}>{department.name}</option>
                  ))}
                </select>
                <div className="grid gap-4 md:grid-cols-2">
                  <select value={String(formState.batch_year)} onChange={(event) => setFormState((current) => ({ ...current, batch_year: Number(event.target.value) }))}>
                    {(selectedDepartmentConfig?.batches || []).map((batch) => <option key={batch} value={batch}>{batch} batch</option>)}
                  </select>
                  <select value={String(formState.semester)} onChange={(event) => setFormState((current) => ({ ...current, semester: Number(event.target.value) }))}>
                    {(selectedDepartmentConfig?.semesters || []).map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}
                  </select>
                </div>
                <input type="email" value={formState.email} onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))} placeholder="Email address" />
                <div className="flex flex-wrap gap-3 pt-2">
                  <ActionButton type="submit" disabled={submitting}>{submitting ? "Saving..." : panelMode === "create" ? "Create student" : "Save changes"}</ActionButton>
                  <ActionButton type="button" variant="secondary" onClick={closePanel}>Cancel</ActionButton>
                </div>
              </form>
            </div>
          </div>
        ) : null}
        </>
        )}
      </AppLayout>
    </>
  );
};

export default StudentsPage;
