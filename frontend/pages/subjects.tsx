import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppLayout } from "../components/AppLayout";
import { ActionButton, Badge, EmptyState, PageIntro, SectionCard, StatCard } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { AttendanceRecord, AttendanceStatus, FacultyProfile, Student, Subject, TimetableEntry } from "../lib/types";
import { formatDate, formatTime, getErrorMessage } from "../lib/utils";

const statusToneMap: Record<AttendanceStatus, "success" | "danger" | "warning"> = {
  present: "success",
  absent: "danger",
  late: "warning",
};

const attendanceBand = (pct: number) => {
  if (pct < 75) return { text: "text-rose-700", bar: "bg-rose-500", badge: "danger" as const };
  if (pct < 85) return { text: "text-amber-700", bar: "bg-amber-500", badge: "warning" as const };
  return { text: "text-emerald-700", bar: "bg-emerald-500", badge: "success" as const };
};

const SubjectsPage = () => {
  const { user } = useAuth();
  const isStudent = user?.role === "student";
  const isTeacher = user?.role === "teacher";

  const [student, setStudent] = useState<Student | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [faculty, setFaculty] = useState<FacultyProfile[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [expandedSyllabus, setExpandedSyllabus] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load data for student role
  useEffect(() => {
    if (!isStudent) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const meRes = await api.get<Student>("/students/me");
        const me = meRes.data;
        if (cancelled) return;
        setStudent(me);

        const [subjectsRes, ttRes, attRes, facultyRes] = await Promise.all([
          api.get<Subject[]>("/subjects", {
            params: { department: me.department, batch_year: me.batch_year },
          }),
          api.get<TimetableEntry[]>("/timetable", {
            params: { department: me.department, batch_year: me.batch_year, semester: me.semester },
          }),
          api.get<AttendanceRecord[]>(`/attendance/student/${me.id}`),
          api.get<FacultyProfile[]>("/faculty").catch(() => ({ data: [] as FacultyProfile[] })),
        ]);
        if (cancelled) return;
        setSubjects(subjectsRes.data);
        setTimetable(ttRes.data);
        setFaculty(facultyRes.data);
        setAttendance(attRes.data);
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e, "Unable to load subjects"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [isStudent]);

  // Load data for teacher role
  useEffect(() => {
    if (!isTeacher) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [ttRes, facultyRes] = await Promise.all([
          api.get<TimetableEntry[]>("/timetable"),
          api.get<FacultyProfile[]>("/faculty").catch(() => ({ data: [] as FacultyProfile[] })),
        ]);
        if (cancelled) return;
        setTimetable(ttRes.data);
        setFaculty(facultyRes.data);
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e, "Unable to load subjects"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [isTeacher]);

  // Load data for admin role
  useEffect(() => {
    if (isStudent || isTeacher) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [subjectsRes, ttRes, facultyRes] = await Promise.all([
          api.get<Subject[]>("/subjects"),
          api.get<TimetableEntry[]>("/timetable"),
          api.get<FacultyProfile[]>("/faculty"),
        ]);
        if (cancelled) return;
        setSubjects(subjectsRes.data);
        setTimetable(ttRes.data);
        setFaculty(facultyRes.data);
      } catch (e) {
        if (!cancelled) setError(getErrorMessage(e, "Unable to load subjects"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [isStudent, isTeacher]);

  // Map: user_id → FacultyProfile
  const facultyByUserId = useMemo(() => {
    const map = new Map<number, FacultyProfile>();
    faculty.forEach((f) => map.set(f.user_id, f));
    return map;
  }, [faculty]);

  // For student/admin: group timetable entries by subject_id → faculty info
  const subjectFacultyMap = useMemo(() => {
    const map = new Map<number, FacultyProfile | null>();
    timetable.forEach((e) => {
      if (!map.has(e.subject_id)) {
        const prof = e.faculty_user_id ? (facultyByUserId.get(e.faculty_user_id) ?? null) : null;
        map.set(e.subject_id, prof);
      }
    });
    return map;
  }, [timetable, facultyByUserId]);

  // For teacher: derive unique subjects from their timetable
  const teacherSubjects = useMemo(() => {
    if (!isTeacher) return [];
    const seen = new Set<number>();
    const result: { entry: TimetableEntry; faculty: FacultyProfile | null }[] = [];
    timetable.forEach((e) => {
      if (!seen.has(e.subject_id)) {
        seen.add(e.subject_id);
        const prof = e.faculty_user_id ? (facultyByUserId.get(e.faculty_user_id) ?? null) : null;
        result.push({ entry: e, faculty: prof });
      }
    });
    return result;
  }, [isTeacher, timetable, facultyByUserId]);

  // For student: current-semester subjects only
  const currentSubjects = useMemo(() => {
    if (!isStudent || !student) return subjects;
    return subjects.filter((s) => s.semester === student.semester);
  }, [isStudent, student, subjects]);

  // Attendance summary per subject
  const subjectAttendance = useMemo(() => {
    const map = new Map<
      number,
      { present: number; late: number; absent: number; total: number; records: AttendanceRecord[] }
    >();
    attendance.forEach((r) => {
      const curr = map.get(r.subject_id) ?? { present: 0, late: 0, absent: 0, total: 0, records: [] };
      curr.total++;
      curr[r.status]++;
      curr.records.push(r);
      map.set(r.subject_id, curr);
    });
    return map;
  }, [attendance]);

  const selectedSubject = useMemo(
    () => currentSubjects.find((s) => s.id === selectedSubjectId) ?? null,
    [currentSubjects, selectedSubjectId],
  );

  const selectedAttendance = useMemo(
    () => (selectedSubjectId ? (subjectAttendance.get(selectedSubjectId) ?? null) : null),
    [selectedSubjectId, subjectAttendance],
  );

  const toggleSyllabus = (id: number) => {
    setExpandedSyllabus((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Timetable slots for the selected subject (for students: which days/times it runs)
  const selectedTimetableSlots = useMemo(
    () => (selectedSubjectId ? timetable.filter((e) => e.subject_id === selectedSubjectId) : []),
    [selectedSubjectId, timetable],
  );

  return (
    <>
      <Head>
        <title>My Subjects | StudentMS</title>
      </Head>
      <AppLayout title="My Subjects">
        <PageIntro
          eyebrow={isTeacher ? "Teaching subjects" : isStudent ? "Your subjects this semester" : "Subject catalogue"}
          title={
            isTeacher
              ? "Subjects you teach"
              : isStudent
                ? "Subjects, faculty & attendance"
                : "All subjects across departments"
          }
          description={
            isTeacher
              ? "A list of every subject assigned to you in the timetable, with class schedule and faculty details."
              : isStudent
                ? "See every subject in your current semester — who teaches it, what the syllabus covers, and your date-wise attendance."
                : "Browse the full subject catalogue. Click a subject to see timetable and faculty assignments."
          }
        />

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            Loading subjects...
          </div>
        ) : null}

        {/* ── STUDENT VIEW ── */}
        {isStudent && !loading ? (
          <div className="space-y-6">
            {student ? (
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Your enrollment</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{student.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {student.enrollment_number} · {student.department} · Batch {student.batch_year} · Semester {student.semester}
                </p>
              </div>
            ) : null}

            {currentSubjects.length === 0 ? (
              <SectionCard title="Subjects" description="">
                <EmptyState
                  title="No subjects found for this semester"
                  description="Subjects will appear here once an admin assigns them to your department, batch, and semester."
                />
              </SectionCard>
            ) : (
              <div className="grid gap-6 xl:grid-cols-[1fr_420px] xl:items-start">
                {/* Subject card grid */}
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-slate-600">
                    {currentSubjects.length} subject{currentSubjects.length !== 1 ? "s" : ""} in Semester {student?.semester}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {currentSubjects.map((subject) => {
                      const att = subjectAttendance.get(subject.id);
                      const pct = att ? Math.round(((att.present + att.late) / att.total) * 100) : null;
                      const band = pct !== null ? attendanceBand(pct) : null;
                      const assignedFaculty = subjectFacultyMap.get(subject.id) ?? null;
                      const selected = selectedSubjectId === subject.id;
                      const sylExpanded = expandedSyllabus.has(subject.id);

                      return (
                        <div
                          key={subject.id}
                          className={`rounded-[22px] border p-5 transition ${
                            selected
                              ? "border-cyan-400 bg-cyan-50/60 ring-2 ring-cyan-400 ring-offset-2"
                              : "border-slate-200 bg-white hover:border-cyan-200 hover:shadow-md"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 leading-tight">{subject.name}</p>
                              {subject.code ? (
                                <p className="mt-0.5 text-xs font-mono text-slate-400">{subject.code}</p>
                              ) : null}
                            </div>
                            {pct !== null && band ? (
                              <Badge tone={band.badge}>{pct}%</Badge>
                            ) : (
                              <Badge tone="neutral">No data</Badge>
                            )}
                          </div>

                          {/* Faculty */}
                          <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-slate-400" aria-hidden>
                              <path d="M12 12c2.76 0 5-2.24 5-5S14.76 2 12 2 7 4.24 7 7s2.24 5 5 5Zm0 2c-3.33 0-10 1.67-10 5v1h20v-1c0-3.33-6.67-5-10-5Z" />
                            </svg>
                            {assignedFaculty ? (
                              <span>{assignedFaculty.name}</span>
                            ) : (
                              <span className="text-slate-400 italic">Faculty not assigned</span>
                            )}
                          </div>

                          {/* Attendance mini bar */}
                          {att && pct !== null && band ? (
                            <div className="mt-3">
                              <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                                <span>{att.present + att.late} attended of {att.total}</span>
                                <span className={band.text}>{pct}%</span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${band.bar}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              {pct < 75 ? (
                                <p className="mt-1 text-[11px] font-semibold text-rose-600">
                                  Below 75% — needs {Math.max(0, Math.ceil(0.75 * att.total) - att.present - att.late)} more classes
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-slate-400">No attendance recorded yet</p>
                          )}

                          {/* Syllabus toggle */}
                          {subject.syllabus ? (
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => toggleSyllabus(subject.id)}
                                className="text-xs font-semibold text-cyan-700 hover:underline"
                              >
                                {sylExpanded ? "Hide syllabus ↑" : "View syllabus ↓"}
                              </button>
                              {sylExpanded ? (
                                <p className="mt-2 text-xs leading-relaxed text-slate-600 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2">
                                  {subject.syllabus}
                                </p>
                              ) : null}
                            </div>
                          ) : null}

                          {/* Actions */}
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedSubjectId((cur) => (cur === subject.id ? null : subject.id))
                              }
                              className={`rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                                selected
                                  ? "border-cyan-600 bg-cyan-600 text-white"
                                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50"
                              }`}
                            >
                              {selected ? "Hide Details" : "View Date-wise Attendance"}
                            </button>
                            {!sylExpanded && subject.syllabus && (
                              <button
                                type="button"
                                onClick={() => toggleSyllabus(subject.id)}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                              >
                                View Syllabus
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Datewise attendance panel */}
                {selectedSubject && selectedAttendance ? (
                  <div className="xl:sticky xl:top-28">
                    <SectionCard
                      title={`${selectedSubject.name} — date-wise`}
                      description="Every marked date, newest first. Green = present, amber = late, red = absent."
                    >
                      <div className="mb-4 grid gap-3 sm:grid-cols-3">
                        <StatCard label="Present" value={selectedAttendance.present} tone="success" />
                        <StatCard label="Late" value={selectedAttendance.late} tone="warning" />
                        <StatCard label="Absent" value={selectedAttendance.absent} tone={selectedAttendance.absent > 0 ? "warning" : "default"} />
                      </div>

                      {/* Schedule slots */}
                      {selectedTimetableSlots.length > 0 ? (
                        <div className="mb-4 space-y-2">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Class schedule</p>
                          {selectedTimetableSlots.map((slot) => (
                            <div key={slot.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                              <span className="font-medium text-slate-700 capitalize">{slot.day}</span>
                              <span className="text-slate-500">{formatTime(slot.start_time)} – {formatTime(slot.end_time)}</span>
                              {slot.room ? <span className="ml-auto text-slate-400 text-xs">Room {slot.room}</span> : null}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="max-h-96 overflow-y-auto space-y-2 scrollbar-thin pr-1">
                        {selectedAttendance.records.length === 0 ? (
                          <p className="text-sm text-slate-500">No records yet.</p>
                        ) : (
                          selectedAttendance.records
                            .slice()
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .map((record) => (
                              <div
                                key={record.id}
                                className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
                                  record.status === "absent"
                                    ? "border-rose-200 bg-rose-50"
                                    : record.status === "late"
                                      ? "border-amber-200 bg-amber-50"
                                      : "border-emerald-200 bg-emerald-50"
                                }`}
                              >
                                <span className="text-sm font-medium text-slate-800">{formatDate(record.date)}</span>
                                <Badge tone={statusToneMap[record.status]}>{record.status}</Badge>
                              </div>
                            ))
                        )}
                      </div>
                    </SectionCard>
                  </div>
                ) : selectedSubject ? (
                  <div className="xl:sticky xl:top-28">
                    <SectionCard title={`${selectedSubject.name} — date-wise`} description="">
                      <EmptyState
                        title="No attendance records"
                        description="Attendance for this subject will appear here once your teacher marks classes."
                      />
                    </SectionCard>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {/* ── TEACHER VIEW ── */}
        {isTeacher && !loading ? (
          <div className="space-y-6">
            {teacherSubjects.length === 0 ? (
              <SectionCard title="Your subjects" description="">
                <EmptyState
                  title="No subjects assigned"
                  description="You have no timetable entries yet. Ask an admin to assign classes to you."
                />
              </SectionCard>
            ) : (
              <>
                <p className="text-sm text-slate-500">
                  {teacherSubjects.length} unique subject{teacherSubjects.length !== 1 ? "s" : ""} assigned to you across all batches.
                </p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {teacherSubjects.map(({ entry, faculty: fac }) => {
                    const slots = timetable.filter((e) => e.subject_id === entry.subject_id);
                    return (
                      <div key={entry.subject_id} className="rounded-[22px] border border-slate-200 bg-white p-5 hover:border-cyan-200 hover:shadow-md transition">
                        <p className="font-semibold text-slate-900">{entry.subject_name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {entry.department} · Batch {entry.batch_year} · Sem {entry.semester}
                        </p>
                        <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-slate-400" aria-hidden>
                            <path d="M12 12c2.76 0 5-2.24 5-5S14.76 2 12 2 7 4.24 7 7s2.24 5 5 5Zm0 2c-3.33 0-10 1.67-10 5v1h20v-1c0-3.33-6.67-5-10-5Z" />
                          </svg>
                          {fac ? fac.name : "—"}
                        </div>
                        <div className="mt-3 space-y-1">
                          {slots.map((s) => (
                            <div key={s.id} className="text-xs text-slate-500 capitalize">
                              {s.day} · {formatTime(s.start_time)}–{formatTime(s.end_time)}
                              {s.room ? ` · Room ${s.room}` : ""}
                            </div>
                          ))}
                        </div>
                        <Link
                          href="/attendance"
                          className="mt-4 inline-flex text-xs font-semibold text-cyan-700 hover:underline"
                        >
                          Mark attendance →
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : null}

        {/* ── ADMIN VIEW ── */}
        {!isStudent && !isTeacher && !loading ? (
          <div className="space-y-6">
            {subjects.length === 0 ? (
              <SectionCard title="Subject catalogue" description="">
                <EmptyState
                  title="No subjects created"
                  description="Subjects are created per department, batch, and semester. Go to Departments or ask an admin to add subjects."
                />
              </SectionCard>
            ) : (
              <>
                <p className="text-sm text-slate-500">{subjects.length} total subjects across all departments and batches.</p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {subjects.map((subject) => {
                    const prof = subjectFacultyMap.get(subject.id) ?? null;
                    return (
                      <div key={subject.id} className="rounded-[22px] border border-slate-200 bg-white p-5 hover:border-cyan-200 hover:shadow-md transition">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">{subject.name}</p>
                            {subject.code ? <p className="text-xs font-mono text-slate-400 mt-0.5">{subject.code}</p> : null}
                          </div>
                          <Badge tone="neutral">Sem {subject.semester}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">{subject.department} · Batch {subject.batch_year}</p>
                        <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-slate-400" aria-hidden>
                            <path d="M12 12c2.76 0 5-2.24 5-5S14.76 2 12 2 7 4.24 7 7s2.24 5 5 5Zm0 2c-3.33 0-10 1.67-10 5v1h20v-1c0-3.33-6.67-5-10-5Z" />
                          </svg>
                          {prof ? prof.name : <span className="text-slate-400 italic">Not assigned</span>}
                        </div>
                        {subject.syllabus ? (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => toggleSyllabus(subject.id)}
                              className="text-xs font-semibold text-cyan-700 hover:underline"
                            >
                              {expandedSyllabus.has(subject.id) ? "Hide syllabus ↑" : "View syllabus ↓"}
                            </button>
                            {expandedSyllabus.has(subject.id) ? (
                              <p className="mt-2 text-xs leading-relaxed text-slate-600 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2">
                                {subject.syllabus}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : null}
      </AppLayout>
    </>
  );
};

export default SubjectsPage;
