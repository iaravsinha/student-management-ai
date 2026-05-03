import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { AppLayout } from "../components/AppLayout";
import { ActionButton, Badge, EmptyState, PageIntro, SectionCard, StatCard } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import {
  AttendanceBulkMarkPayload,
  AttendanceRecord,
  AttendanceStatus,
  ResultRecord,
  Student,
  StudentListResponse,
  Subject,
  TimetableEntry,
} from "../lib/types";
import { WEEK_DAYS, formatDate, formatLabel, formatTime, getErrorMessage, getLocalDateInputValue } from "../lib/utils";

const getWeekDayValue = (value: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date(value)).toLowerCase();

const statusToneMap: Record<AttendanceStatus, "success" | "danger" | "warning"> = {
  present: "success",
  absent: "danger",
  late: "warning",
};

const attendanceBand = (percentage: number) => {
  if (percentage < 75) {
    return {
      badge: "danger" as const,
      card: "border-rose-200 bg-rose-50/50",
      bar: "bg-rose-500",
      label: "Below 75%",
    };
  }
  if (percentage < 85) {
    return {
      badge: "warning" as const,
      card: "border-amber-200 bg-amber-50/40",
      bar: "bg-amber-500",
      label: "75-84%",
    };
  }
  return {
    badge: "success" as const,
    card: "border-emerald-200 bg-emerald-50/40",
    bar: "bg-emerald-500",
    label: "85-100%",
  };
};

const getNextDateForWeekDay = (targetDay: string, fromDate: string) => {
  const baseDate = new Date(`${fromDate}T00:00:00`);
  const currentIndex = WEEK_DAYS.indexOf(getWeekDayValue(fromDate) as (typeof WEEK_DAYS)[number]);
  const targetIndex = WEEK_DAYS.indexOf(targetDay as (typeof WEEK_DAYS)[number]);
  if (currentIndex < 0 || targetIndex < 0) return fromDate;
  const delta = (targetIndex - currentIndex + 7) % 7;
  const nextDate = new Date(baseDate);
  nextDate.setDate(baseDate.getDate() + delta);
  return getLocalDateInputValue(nextDate);
};

const AttendancePage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  const isStudent = user?.role === "student";
  const today = useMemo(() => getLocalDateInputValue(new Date()), []);

  // ── Teacher state ─────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(today);
  const [weeklyTeacherTimetable, setWeeklyTeacherTimetable] = useState<TimetableEntry[]>([]);
  const [teacherTimetable, setTeacherTimetable] = useState<TimetableEntry[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [attendanceDraft, setAttendanceDraft] = useState<Record<number, AttendanceStatus>>({});
  const [remarksDraft, setRemarksDraft] = useState<Record<number, string>>({});
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [savingRoster, setSavingRoster] = useState(false);

  // ── Teacher roster search ─────────────────────────────────────────────────
  const [rosterSearch, setRosterSearch] = useState("");

  // ── Admin / student lookup state ──────────────────────────────────────────
  const [lookupStudent, setLookupStudent] = useState<Student | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [subjectMap, setSubjectMap] = useState<Map<number, string>>(new Map());
  const [subjectDetailsMap, setSubjectDetailsMap] = useState<Map<number, Subject>>(new Map());
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // ── Shared ────────────────────────────────────────────────────────────────
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  // ── Derived: teacher ──────────────────────────────────────────────────────
  const selectedWeekDay = useMemo(() => getWeekDayValue(selectedDate), [selectedDate]);
  const availableTeacherDays = useMemo(
    () => Array.from(new Set(weeklyTeacherTimetable.map((e) => e.day))),
    [weeklyTeacherTimetable],
  );
  const selectedClass = useMemo(
    () => teacherTimetable.find((e) => e.id === selectedClassId) ?? null,
    [selectedClassId, teacherTimetable],
  );

  // ── Derived: admin/student ────────────────────────────────────────────────
  const filteredStudents = useMemo(
    () =>
      studentSearch.trim()
        ? allStudents.filter(
            (s) =>
              s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
              s.enrollment_number.toLowerCase().includes(studentSearch.toLowerCase()),
          )
        : allStudents,
    [allStudents, studentSearch],
  );

  const subjectSummary = useMemo(() => {
    const map = new Map<number, { present: number; late: number; absent: number; total: number; records: AttendanceRecord[] }>();
    history.forEach((r) => {
      const c = map.get(r.subject_id) ?? { present: 0, late: 0, absent: 0, total: 0, records: [] };
      c.total += 1;
      c[r.status] += 1;
      c.records.push(r);
      map.set(r.subject_id, c);
    });
    return Array.from(map.entries())
      .map(([id, stats]) => ({
        subjectId: id,
        name: subjectMap.get(id) ?? `Subject ${id}`,
        subject: subjectDetailsMap.get(id),
        ...stats,
        pct: stats.total ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0,
      }))
      .sort((a, b) => a.pct - b.pct);
  }, [history, subjectDetailsMap, subjectMap]);

  const selectedSubjectSummary = useMemo(() => {
    if (selectedSubjectId == null) {
      return subjectSummary[0] ?? null;
    }
    return subjectSummary.find((subject) => subject.subjectId === selectedSubjectId) ?? subjectSummary[0] ?? null;
  }, [selectedSubjectId, subjectSummary]);

  const filteredRoster = useMemo(() => {
    if (!rosterSearch.trim()) return classStudents;
    const q = rosterSearch.toLowerCase();
    return classStudents.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.enrollment_number || "").toLowerCase().includes(q),
    );
  }, [classStudents, rosterSearch]);

  const rosterStats = useMemo(() => {
    const statuses = classStudents.map((student) => attendanceDraft[student.id] ?? "present");
    return {
      present: statuses.filter((status) => status === "present").length,
      late: statuses.filter((status) => status === "late").length,
      absent: statuses.filter((status) => status === "absent").length,
      total: statuses.length,
    };
  }, [attendanceDraft, classStudents]);

  const overallStats = useMemo(() => {
    const total = history.length;
    const attended = history.filter((r) => r.status !== "absent").length;
    const absent = total - attended;
    const pct = total ? Math.round((attended / total) * 100) : 0;
    return { total, attended, absent, pct };
  }, [history]);

  // ── Effects: teacher ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isTeacher) return;
    const load = async () => {
      setLoadingClasses(true);
      setError("");
      try {
        const [weekly, day] = await Promise.all([
          api.get<TimetableEntry[]>("/timetable"),
          api.get<TimetableEntry[]>(`/timetable/day/${selectedWeekDay}`),
        ]);
        setWeeklyTeacherTimetable(weekly.data);
        setTeacherTimetable(day.data);
      } catch (e) {
        setError(getErrorMessage(e, "Unable to load your assigned classes"));
      } finally {
        setLoadingClasses(false);
      }
    };
    void load();
  }, [isTeacher, selectedWeekDay]);

  useEffect(() => {
    if (!isTeacher || teacherTimetable.length > 0 || availableTeacherDays.length === 0) return;
    const preferred = availableTeacherDays.includes(selectedWeekDay as (typeof WEEK_DAYS)[number])
      ? selectedWeekDay
      : availableTeacherDays[0];
    if (preferred !== selectedWeekDay) setSelectedDate(getNextDateForWeekDay(preferred, selectedDate));
  }, [availableTeacherDays, isTeacher, selectedDate, selectedWeekDay, teacherTimetable.length]);

  useEffect(() => {
    if (!isTeacher) return;
    setSelectedClassId((cur) => {
      if (teacherTimetable.length === 0) return null;
      if (cur && teacherTimetable.some((e) => e.id === cur)) return cur;
      return teacherTimetable[0].id;
    });
  }, [isTeacher, teacherTimetable]);

  useEffect(() => {
    if (!isTeacher || !selectedClassId) {
      setClassStudents([]);
      setAttendanceDraft({});
      setRosterSearch("");
      return;
    }
    const load = async () => {
      setLoadingRoster(true);
      setError("");
      try {
        const [studs, att] = await Promise.all([
          api.get<Student[]>(`/students/class/${selectedClassId}`),
          api.get<AttendanceRecord[]>(`/attendance/class/${selectedClassId}`, {
            params: { attendance_date: selectedDate },
          }),
        ]);
        const existing = Object.fromEntries(att.data.map((r) => [r.student_id, r.status])) as Record<
          number,
          AttendanceStatus
        >;
        setClassStudents(studs.data);
        setAttendanceDraft(
          Object.fromEntries(
            studs.data.map((s) => [s.id, existing[s.id] ?? "present"]),
          ) as Record<number, AttendanceStatus>,
        );
        setRemarksDraft(
          Object.fromEntries(
            studs.data.map((s) => [s.id, att.data.find(r => r.student_id === s.id)?.remarks ?? ""]),
          ) as Record<number, string>,
        );
      } catch (e) {
        setError(getErrorMessage(e, "Unable to load class roster"));
        setClassStudents([]);
        setAttendanceDraft({});
      } finally {
        setLoadingRoster(false);
      }
    };
    void load();
  }, [isTeacher, selectedClassId, selectedDate]);

  // ── Effects: admin student list ───────────────────────────────────────────
  useEffect(() => {
    if (isTeacher || isStudent) return;
    let cancelled = false;
    const load = async () => {
      setLoadingStudents(true);
      try {
        const res = await api.get<StudentListResponse>("/students", {
          params: { page: 1, page_size: 200 },
        });
        if (!cancelled) setAllStudents(res.data.items);
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e, "Unable to load student list"));
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [isTeacher, isStudent]);

  // ── Effects: student auto-profile ─────────────────────────────────────────
  useEffect(() => {
    if (!isStudent) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.get<Student>("/students/me");
        if (!cancelled) setLookupStudent(res.data);
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e, "Unable to load your student profile"));
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [isStudent]);

  // ── Effects: ?student_id query param (from students page link) ────────────
  useEffect(() => {
    if (!router.isReady || isStudent || isTeacher) return;
    const qId = router.query.student_id;
    const studentId = typeof qId === "string" ? Number(qId) : null;
    if (!studentId || Number.isNaN(studentId)) return;
    const fetchById = async () => {
      try {
        const res = await api.get<Student>(`/students/${studentId}`);
        setLookupStudent(res.data);
      } catch {
        // ignore silently — student may not exist
      }
    };
    void fetchById();
  }, [router.isReady, router.query.student_id, isStudent, isTeacher]);

  useEffect(() => {
    if (!router.isReady) return;
    const qSubId = router.query.subject_id;
    if (qSubId && !Number.isNaN(Number(qSubId))) {
      setSelectedSubjectId(Number(qSubId));
    }
  }, [router.isReady, router.query.subject_id]);

  // ── Effects: load attendance + build subject map ───────────────────────────
  useEffect(() => {
    if (!lookupStudent) {
      setHistory([]);
      setSubjectMap(new Map());
      setSubjectDetailsMap(new Map());
      setSelectedSubjectId(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoadingHistory(true);
      setError("");
      try {
        const [histResp, ttResp, resResp, subjectResp] = await Promise.all([
          api.get<AttendanceRecord[]>(`/attendance/student/${lookupStudent.id}`),
          api.get<TimetableEntry[]>("/timetable", {
            params: {
              department: lookupStudent.department,
              batch_year: lookupStudent.batch_year,
              semester: lookupStudent.semester,
            },
          }),
          api.get<ResultRecord[]>(`/results/student/${lookupStudent.id}`),
          api.get<Subject[]>("/subjects", {
            params: {
              department: lookupStudent.department,
              batch_year: lookupStudent.batch_year,
            },
          }),
        ]);
        if (!cancelled) {
          const map = new Map<number, string>();
          const details = new Map<number, Subject>();
          subjectResp.data.forEach((subject) => {
            map.set(subject.id, subject.name);
            details.set(subject.id, subject);
          });
          ttResp.data.forEach((e) => map.set(e.subject_id, e.subject_name));
          resResp.data.forEach((r) => {
            if (!map.has(r.subject_id)) map.set(r.subject_id, r.subject_name);
          });
          setSubjectMap(map);
          setSubjectDetailsMap(details);
          setHistory(histResp.data);
          setSelectedSubjectId((current) => (current && histResp.data.some((record) => record.subject_id === current) ? current : histResp.data[0]?.subject_id ?? null));
        }
      } catch (e) {
        if (!cancelled) {
          setError(getErrorMessage(e, "Unable to load attendance data"));
          setHistory([]);
        }
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [lookupStudent]);

  // ── Event handlers ────────────────────────────────────────────────────────
  const submitRosterAttendance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClassId || classStudents.length === 0) return;
    setSavingRoster(true);
    setError("");
    setFeedback("");
    const payload: AttendanceBulkMarkPayload = {
      timetable_id: selectedClassId,
      date: selectedDate,
      records: classStudents.map((s) => ({
        student_id: s.id,
        status: attendanceDraft[s.id] ?? "present",
        remarks: remarksDraft[s.id] || undefined,
      })),
    };
    try {
      await api.post("/attendance/mark-bulk", payload);
      setFeedback(`Attendance submitted for ${selectedClass?.subject_name ?? "class"} on ${formatDate(selectedDate)}.`);
    } catch (e) {
      setError(getErrorMessage(e, "Unable to submit class attendance"));
    } finally {
      setSavingRoster(false);
    }
  };

  const setAllRosterStatuses = (status: AttendanceStatus) => {
    setAttendanceDraft(
      Object.fromEntries(classStudents.map((s) => [s.id, status])) as Record<number, AttendanceStatus>,
    );
  };

  const clearLookup = () => {
    setLookupStudent(null);
    setHistory([]);
    setSubjectMap(new Map());
    setSubjectDetailsMap(new Map());
    setSelectedSubjectId(null);
    setStudentSearch("");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>Attendance | StudentMS</title>
      </Head>
      <AppLayout title="Attendance">
        <PageIntro
          eyebrow="Attendance operations"
          title={
            isTeacher
              ? "Mark attendance from your daily class list"
              : isStudent
                ? "Your attendance record"
                : "Attendance insights"
          }
          description={
            isTeacher
              ? "Pick a date, open a class roster, and submit present, absent, or late status for each student."
              : isStudent
                ? "Review your complete attendance history and subject-wise percentages."
                : "Select a student to view their attendance history, subject breakdown, and at-risk flags."
          }
        />

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}
        {feedback ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {feedback}
          </div>
        ) : null}

        {isTeacher ? (
          /* ════════════ TEACHER VIEW ════════════ */
          <section className="grid gap-6">
            <SectionCard
              title={`${formatLabel(selectedWeekDay)} teaching schedule`}
              description="Pick a date to load your assigned classes for that weekday, then open one class to mark the whole roster."
              actions={
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="min-w-[180px]"
                />
              }
            >
              {availableTeacherDays.length > 0 ? (
                <div className="mb-4 flex flex-wrap gap-2">
                  {availableTeacherDays.map((day) => (
                    <ActionButton
                      key={day}
                      type="button"
                      variant={day === selectedWeekDay ? "primary" : "secondary"}
                      onClick={() => setSelectedDate(getNextDateForWeekDay(day, selectedDate))}
                    >
                      {formatLabel(day)}
                    </ActionButton>
                  ))}
                </div>
              ) : null}

              {loadingClasses ? (
                <p className="text-sm text-slate-500">Loading your assigned classes...</p>
              ) : null}

              {!loadingClasses && teacherTimetable.length === 0 ? (
                <EmptyState
                  title="No classes scheduled"
                  description={
                    availableTeacherDays.length > 0
                      ? "No class is assigned on this weekday. Use the day buttons above to jump to one of your scheduled teaching days."
                      : "There are no timetable entries assigned to you yet. Ask an admin to update the timetable."
                  }
                />
              ) : null}

              {teacherTimetable.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {teacherTimetable.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setSelectedClassId(entry.id)}
                      className={`rounded-3xl border p-5 text-left transition ${
                        entry.id === selectedClassId
                          ? "border-brand-300 bg-brand-50"
                          : "border-slate-200 bg-slate-50 hover:border-brand-200 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-slate-950">{entry.subject_name}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {entry.department} — {entry.batch_year} batch — Sem {entry.semester}
                          </p>
                        </div>
                        <Badge tone="brand">
                          {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
                        </Badge>
                      </div>
                      <p className="mt-4 text-sm text-slate-500">
                        {entry.room ? `Room ${entry.room}` : "Room not assigned"}
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}
            </SectionCard>

            <SectionCard
              title={selectedClass ? `${selectedClass.subject_name} attendance roster` : "Class roster"}
              description={
                selectedClass
                  ? "Set each student explicitly as present, late, or absent. Existing marks for the selected date are loaded before you submit."
                  : "Select a class from your daily schedule above to load the attendance roster."
              }
            >
              {!selectedClass ? (
                <EmptyState
                  title="Choose a class first"
                  description="The attendance roster will appear here once you select one of your assigned classes above."
                />
              ) : loadingRoster ? (
                <p className="text-sm text-slate-500">Loading class roster...</p>
              ) : classStudents.length === 0 ? (
                <EmptyState
                  title="No students in this class"
                  description="No students were found matching this class's department, batch, and semester. Check that students have been added to the system."
                />
              ) : (
                <form className="space-y-5" onSubmit={(e) => void submitRosterAttendance(e)}>
                  <div className="grid gap-4 md:grid-cols-4">
                    <StatCard label="Date" value={formatDate(selectedDate)} />
                    <StatCard label="Total" value={rosterStats.total} />
                    <StatCard label="Present + Late" value={rosterStats.present + rosterStats.late} tone="success" />
                    <StatCard label="Absent" value={rosterStats.absent} tone={rosterStats.absent > 0 ? "warning" : "default"} />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <ActionButton type="button" variant="secondary" onClick={() => setAllRosterStatuses("present")}>
                      All present
                    </ActionButton>
                    <ActionButton type="button" variant="secondary" onClick={() => setAllRosterStatuses("late")}>
                      All late
                    </ActionButton>
                    <ActionButton type="button" variant="secondary" onClick={() => setAllRosterStatuses("absent")}>
                      All absent
                    </ActionButton>
                    <div className="ml-auto min-w-[200px]">
                      <input
                        value={rosterSearch}
                        onChange={(e) => setRosterSearch(e.target.value)}
                        placeholder="Search student..."
                        className="!py-2 text-sm"
                      />
                    </div>
                  </div>

                  {filteredRoster.length === 0 && rosterSearch ? (
                    <p className="text-sm text-slate-500">No students match your search.</p>
                  ) : null}

                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">Student</th>
                          <th className="px-4 py-3 font-medium hidden sm:table-cell">Enrollment</th>
                          <th className="px-4 py-3 font-medium">Mark status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredRoster.map((student) => {
                          const status = attendanceDraft[student.id] ?? "present";
                          return (
                            <tr key={student.id} className={status === "absent" ? "bg-rose-50/40" : status === "late" ? "bg-amber-50/40" : ""}>
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-900">{student.name}</p>
                                <p className="text-xs text-slate-500">Roll {student.roll_number ?? "—"} · Sem {student.semester}</p>
                              </td>
                              <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{student.enrollment_number}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  {(["present", "late", "absent"] as AttendanceStatus[]).map((option) => (
                                    <button
                                      key={option}
                                      type="button"
                                      onClick={() =>
                                        setAttendanceDraft((cur) => ({
                                          ...cur,
                                          [student.id]: option,
                                        }))
                                      }
                                      className={`rounded-xl border px-3 py-1.5 text-xs font-semibold capitalize transition ${
                                        status === option
                                          ? option === "present"
                                            ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                                            : option === "late"
                                              ? "border-amber-300 bg-amber-100 text-amber-800"
                                              : "border-rose-300 bg-rose-100 text-rose-800"
                                          : "border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:bg-cyan-50"
                                      }`}
                                    >
                                      {option}
                                    </button>
                                  ))}
                                </div>
                                <input
                                  value={remarksDraft[student.id] || ""}
                                  onChange={(e) =>
                                    setRemarksDraft((cur) => ({
                                      ...cur,
                                      [student.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Add remark..."
                                  className="mt-2 !py-1 text-xs"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <ActionButton type="submit" disabled={savingRoster}>
                      {savingRoster ? "Saving..." : `Submit attendance for ${formatDate(selectedDate)}`}
                    </ActionButton>
                    <p className="text-xs text-slate-500">
                      {rosterStats.total} students · {rosterStats.present} present · {rosterStats.late} late · {rosterStats.absent} absent
                    </p>
                  </div>
                </form>
              )}
            </SectionCard>
          </section>
        ) : (
          /* ════════════ ADMIN / STUDENT VIEW ════════════ */
          <div className="space-y-6">
            {/* Admin: student search picker */}
            {!isStudent ? (
              <SectionCard
                title="Student lookup"
                description="Search by name or enrollment number to view their attendance records and subject breakdown."
              >
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
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{lookupStudent.name}</p>
                        <p className="mt-0.5 text-sm text-slate-500">
                          {lookupStudent.enrollment_number} · {lookupStudent.department} · Batch{" "}
                          {lookupStudent.batch_year} · Sem {lookupStudent.semester}
                        </p>
                      </div>
                      <Link
                        href={`/students?department=${encodeURIComponent(lookupStudent.department)}&batch_year=${lookupStudent.batch_year}`}
                        className="ml-auto shrink-0 text-sm font-semibold text-cyan-800 hover:underline"
                      >
                        View full profile →
                      </Link>
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                      {loadingStudents ? (
                        <p className="px-4 py-4 text-sm text-slate-500">Loading students...</p>
                      ) : filteredStudents.length === 0 ? (
                        <p className="px-4 py-4 text-sm text-slate-500">
                          {allStudents.length === 0
                            ? "No students found. Add students first via the Students page."
                            : "No students match your search."}
                        </p>
                      ) : (
                        filteredStudents.slice(0, 30).map((student) => (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => setLookupStudent(student)}
                            className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50"
                          >
                            <div>
                              <p className="text-sm font-medium text-slate-900">{student.name}</p>
                              <p className="text-xs text-slate-500">
                                {student.enrollment_number} · {student.department}
                              </p>
                            </div>
                            <span className="shrink-0 text-xs text-slate-400">
                              Batch {student.batch_year} · Sem {student.semester}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </SectionCard>
            ) : null}

            {/* Student: own enrollment card */}
            {isStudent && lookupStudent ? (
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Your enrollment
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{lookupStudent.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {lookupStudent.enrollment_number} · {lookupStudent.department} · Batch{" "}
                  {lookupStudent.batch_year} · Semester {lookupStudent.semester}
                </p>
              </div>
            ) : null}

            {/* Student profile still loading */}
            {isStudent && !lookupStudent && !loadingHistory ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                Loading your profile...
              </div>
            ) : null}

            {/* Prompt when no student selected yet (admin only) */}
            {!lookupStudent && !isStudent ? (
              <SectionCard title="Attendance view" description="">
                <EmptyState
                  title="No student selected"
                  description="Use the student lookup above to search by name or enrollment number, then click a student to view their attendance records."
                />
              </SectionCard>
            ) : null}

            {/* Loading attendance data */}
            {loadingHistory ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                Loading attendance records...
              </div>
            ) : null}

            {/* Data: only show when loaded and a student is selected */}
            {!loadingHistory && lookupStudent ? (
              <>
                {/* Overall stats */}
                {history.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Total classes" value={overallStats.total} />
                    <StatCard label="Attended" value={overallStats.attended} tone="success" />
                    <StatCard label="Absent" value={overallStats.absent} tone={overallStats.absent > 0 ? "warning" : "default"} />
                    <StatCard
                      label="Overall attendance"
                      value={`${overallStats.pct}%`}
                      tone={overallStats.pct >= 75 ? "success" : "warning"}
                      hint={overallStats.pct < 75 ? "Below 75% threshold" : undefined}
                    />
                  </div>
                ) : null}

                {/* Per-subject breakdown */}
                {subjectSummary.length > 0 ? (
                  <SectionCard
                    title="Subject-wise breakdown"
                    description="Click a subject to inspect every marked date. Red is below 75%, yellow is below 85%, and green is 85% or higher."
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      {subjectSummary.map((subject) => {
                        const band = attendanceBand(subject.pct);
                        const selected = selectedSubjectSummary?.subjectId === subject.subjectId;
                        return (
                          <button
                            key={subject.subjectId}
                            type="button"
                            onClick={() => setSelectedSubjectId(subject.subjectId)}
                            className={`rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md ${band.card} ${
                              selected ? "ring-2 ring-cyan-500 ring-offset-2" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="min-w-0 truncate font-semibold text-slate-900">{subject.name}</p>
                              <Badge tone={band.badge}>{subject.pct}%</Badge>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              Present {subject.present} | Late {subject.late} | Absent {subject.absent} of {subject.total} classes
                            </p>
                            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/80">
                              <div className={`h-full rounded-full transition-all duration-500 ${band.bar}`} style={{ width: `${subject.pct}%` }} />
                            </div>
                            <p className="mt-2 text-[11px] font-semibold text-slate-500">{band.label}</p>
                            {subject.pct < 75 ? (
                              <p className="mt-2 text-[11px] font-semibold text-rose-600">
                                Needs {Math.max(0, Math.ceil(0.75 * subject.total) - subject.present - subject.late)} more attended classes to reach 75%
                              </p>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </SectionCard>
                ) : null}

                {selectedSubjectSummary ? (
                  <SectionCard
                    title={`${selectedSubjectSummary.name} date-wise attendance`}
                    description="Historical marks for the selected subject, newest first."
                  >
                    <div className="mb-4 grid gap-3 sm:grid-cols-3">
                      <StatCard label="Present" value={selectedSubjectSummary.present} tone="success" />
                      <StatCard label="Late" value={selectedSubjectSummary.late} tone="warning" />
                      <StatCard label="Absent" value={selectedSubjectSummary.absent} tone={selectedSubjectSummary.absent > 0 ? "warning" : "default"} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {selectedSubjectSummary.records
                        .slice()
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((record) => (
                          <div
                            key={record.id}
                            className={`rounded-2xl border px-4 py-3 ${
                              record.status === "absent"
                                ? "border-rose-200 bg-rose-50"
                                : record.status === "late"
                                  ? "border-amber-200 bg-amber-50"
                                  : "border-emerald-200 bg-emerald-50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-semibold text-slate-800">{formatDate(record.date)}</span>
                              <Badge tone={statusToneMap[record.status]}>{record.status}</Badge>
                            </div>
                            {record.remarks ? (
                              <p className="mt-1 text-[11px] text-slate-500 italic">“{record.remarks}”</p>
                            ) : null}
                          </div>
                        ))}
                    </div>
                  </SectionCard>
                ) : null}

                {/* Full history table */}
                <SectionCard
                  title="Attendance history"
                  description={
                    lookupStudent
                      ? `All attendance records for ${lookupStudent.name}, most recent first.`
                      : "Your complete attendance history, most recent first."
                  }
                >
                  {history.length === 0 ? (
                    <EmptyState
                      title="No attendance records"
                      description="Attendance records will appear here once teachers start marking classes for this student's batch and semester."
                    />
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium">Subject</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {history
                            .slice()
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .map((record) => (
                              <tr
                                key={record.id}
                                className={
                                  record.status === "absent"
                                    ? "bg-rose-50/30"
                                    : record.status === "late"
                                      ? "bg-amber-50/30"
                                      : ""
                                }
                              >
                                <td className="px-4 py-3 text-slate-600">{formatDate(record.date)}</td>
                                <td className="px-4 py-3 font-medium text-slate-800">
                                  {subjectMap.get(record.subject_id) ?? `Subject ${record.subject_id}`}
                                </td>
                                <td className="px-4 py-3">
                                  <Badge tone={statusToneMap[record.status]}>{record.status}</Badge>
                                  {record.remarks ? (
                                    <p className="mt-1 text-[10px] text-slate-400 italic leading-tight">{record.remarks}</p>
                                  ) : null}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>
              </>
            ) : null}
          </div>
        )}
      </AppLayout>
    </>
  );
};

export default AttendancePage;
