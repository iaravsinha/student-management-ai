import Head from "next/head";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { AppLayout } from "../components/AppLayout";
import { ActionButton, Badge, EmptyState, PageIntro, SectionCard, StatCard } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import {
  AttendanceBulkMarkPayload,
  AttendancePercentage,
  AttendanceRecord,
  AttendanceStatus,
  Student,
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

const getNextDateForWeekDay = (targetDay: string, fromDate: string) => {
  const baseDate = new Date(`${fromDate}T00:00:00`);
  const currentIndex = WEEK_DAYS.indexOf(getWeekDayValue(fromDate) as typeof WEEK_DAYS[number]);
  const targetIndex = WEEK_DAYS.indexOf(targetDay as typeof WEEK_DAYS[number]);
  if (currentIndex < 0 || targetIndex < 0) {
    return fromDate;
  }
  const delta = (targetIndex - currentIndex + 7) % 7;
  const nextDate = new Date(baseDate);
  nextDate.setDate(baseDate.getDate() + delta);
  return getLocalDateInputValue(nextDate);
};

const AttendancePage = () => {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  const isStudentUser = user?.role === "student";
  const today = useMemo(() => getLocalDateInputValue(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [myProfile, setMyProfile] = useState<Student | null>(null);
  const [lookupStudentId, setLookupStudentId] = useState("");
  const [lookupSubjectId, setLookupSubjectId] = useState("");
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [percentage, setPercentage] = useState<AttendancePercentage | null>(null);
  const [weeklyTeacherTimetable, setWeeklyTeacherTimetable] = useState<TimetableEntry[]>([]);
  const [teacherTimetable, setTeacherTimetable] = useState<TimetableEntry[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [attendanceDraft, setAttendanceDraft] = useState<Record<number, AttendanceStatus>>({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [savingRoster, setSavingRoster] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const selectedWeekDay = useMemo(() => getWeekDayValue(selectedDate), [selectedDate]);
  const todaysClasses = useMemo(() => teacherTimetable, [teacherTimetable]);
  const availableTeacherDays = useMemo(
    () => Array.from(new Set(weeklyTeacherTimetable.map((entry) => entry.day))),
    [weeklyTeacherTimetable],
  );
  const selectedClass = useMemo(
    () => todaysClasses.find((entry) => entry.id === selectedClassId) || null,
    [selectedClassId, todaysClasses],
  );
  const filteredHistory = useMemo(() => {
    const subjectId = Number(lookupSubjectId);
    if (!subjectId) {
      return history;
    }
    return history.filter((record) => record.subject_id === subjectId);
  }, [history, lookupSubjectId]);

  useEffect(() => {
    if (!isStudentUser) {
      return;
    }

    const loadMyProfile = async () => {
      try {
        const response = await api.get<Student>("/students/me");
        setMyProfile(response.data);
        setLookupStudentId(String(response.data.id));
      } catch (loadError) {
        setError(getErrorMessage(loadError, "Unable to load your student profile"));
      }
    };

    void loadMyProfile();
  }, [isStudentUser]);

  useEffect(() => {
    if (!isTeacher) {
      return;
    }

    const loadTeacherClasses = async () => {
      setLoadingClasses(true);
      setError("");
      try {
        const [weeklyResponse, dayResponse] = await Promise.all([
          api.get<TimetableEntry[]>("/timetable"),
          api.get<TimetableEntry[]>(`/timetable/day/${selectedWeekDay}`),
        ]);
        setWeeklyTeacherTimetable(weeklyResponse.data);
        setTeacherTimetable(dayResponse.data);
      } catch (loadError) {
        setError(getErrorMessage(loadError, "Unable to load your assigned classes"));
      } finally {
        setLoadingClasses(false);
      }
    };

    void loadTeacherClasses();
  }, [isTeacher, selectedWeekDay]);

  useEffect(() => {
    if (!isTeacher || todaysClasses.length > 0 || availableTeacherDays.length === 0) {
      return;
    }
    const preferredDay = availableTeacherDays.includes(selectedWeekDay as (typeof WEEK_DAYS)[number])
      ? selectedWeekDay
      : availableTeacherDays[0];
    if (preferredDay !== selectedWeekDay) {
      setSelectedDate(getNextDateForWeekDay(preferredDay, selectedDate));
    }
  }, [availableTeacherDays, isTeacher, selectedDate, selectedWeekDay, todaysClasses.length]);

  useEffect(() => {
    if (!isTeacher) {
      return;
    }
    setSelectedClassId((current) => {
      if (todaysClasses.length === 0) {
        return null;
      }
      if (current && todaysClasses.some((entry) => entry.id === current)) {
        return current;
      }
      return todaysClasses[0].id;
    });
  }, [isTeacher, todaysClasses]);

  useEffect(() => {
    if (!isTeacher || !selectedClassId) {
      setClassStudents([]);
      setAttendanceDraft({});
      return;
    }

    const loadClassRoster = async () => {
      setLoadingRoster(true);
      setError("");
      try {
        const [studentsResponse, attendanceResponse] = await Promise.all([
          api.get<Student[]>(`/students/class/${selectedClassId}`),
          api.get<AttendanceRecord[]>(`/attendance/class/${selectedClassId}`, { params: { attendance_date: selectedDate } }),
        ]);
        const existingStatuses = Object.fromEntries(
          attendanceResponse.data.map((record) => [record.student_id, record.status]),
        ) as Record<number, AttendanceStatus>;
        setClassStudents(studentsResponse.data);
        setAttendanceDraft(
          Object.fromEntries(
            studentsResponse.data.map((student) => [student.id, existingStatuses[student.id] || "present"]),
          ) as Record<number, AttendanceStatus>,
        );
      } catch (loadError) {
        setError(getErrorMessage(loadError, "Unable to load the class roster"));
        setClassStudents([]);
        setAttendanceDraft({});
      } finally {
        setLoadingRoster(false);
      }
    };

    void loadClassRoster();
  }, [isTeacher, selectedClassId, selectedDate]);

  const loadHistory = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setLoadingHistory(true);
    setError("");

    try {
      const studentId = Number(lookupStudentId);
      const subjectId = Number(lookupSubjectId);
      if (!studentId) {
        setError("Select a student before loading attendance insights.");
        return;
      }
      const [historyResponse, percentageResponse] = await Promise.all([
        api.get<AttendanceRecord[]>(`/attendance/student/${studentId}`),
        subjectId
          ? api.get<AttendancePercentage>(`/attendance/percentage/${studentId}/${subjectId}`)
          : Promise.resolve({ data: null as AttendancePercentage | null }),
      ]);
      setHistory(historyResponse.data);
      setPercentage(percentageResponse.data);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to fetch attendance data"));
      setHistory([]);
      setPercentage(null);
    } finally {
      setLoadingHistory(false);
    }
  };

  const submitRosterAttendance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClassId || classStudents.length === 0) {
      return;
    }

    setSavingRoster(true);
    setError("");
    setFeedback("");

    const payload: AttendanceBulkMarkPayload = {
      timetable_id: selectedClassId,
      date: selectedDate,
      records: classStudents.map((student) => ({
        student_id: student.id,
        status: attendanceDraft[student.id] || "present",
      })),
    };

    try {
      await api.post("/attendance/mark-bulk", payload);
      setFeedback("Attendance submitted for the selected class.");
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Unable to submit class attendance"));
    } finally {
      setSavingRoster(false);
    }
  };

  const setAllRosterStatuses = (status: AttendanceStatus) => {
    setAttendanceDraft(
      Object.fromEntries(classStudents.map((student) => [student.id, status])) as Record<number, AttendanceStatus>,
    );
  };

  return (
    <>
      <Head>
        <title>Attendance | StudentMS</title>
      </Head>
      <AppLayout title="Attendance">
        <PageIntro
          eyebrow="Attendance operations"
          title={isTeacher ? "Mark attendance from your daily class list" : "Review attendance and subject insights"}
          description={
            isTeacher
              ? "Teachers now get a date-wise class list, open a class roster, and submit present, absent, or late status with one explicit save action."
              : isStudentUser
                ? "Review only your own attendance, subject percentages, and attendance history."
                : "Admins can review attendance insights, while attendance marking is reserved for teachers."
          }
        />

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {feedback ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}

        {isTeacher ? (
          <section className="grid gap-6">
            <SectionCard
              title={`${formatLabel(selectedWeekDay)} teaching schedule`}
              description="Pick a date to load the classes assigned to you for that weekday, then open one class to mark the whole roster."
              actions={<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="min-w-[180px]" />}
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
              {loadingClasses ? <p className="text-sm text-slate-500">Loading your assigned classes...</p> : null}
              {!loadingClasses && todaysClasses.length === 0 ? (
                <EmptyState
                  title="No classes scheduled"
                  description={availableTeacherDays.length > 0 ? "No class is assigned on this weekday. Use the weekday buttons above to jump to one of your scheduled teaching days." : "There are no timetable entries assigned to you yet."}
                />
              ) : null}
              {todaysClasses.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {todaysClasses.map((entry) => (
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
                            {entry.department} - {entry.batch_year} batch - Semester {entry.semester}
                          </p>
                        </div>
                        <Badge tone="brand">{formatTime(entry.start_time)} - {formatTime(entry.end_time)}</Badge>
                      </div>
                      <p className="mt-4 text-sm text-slate-500">{entry.room ? `Room ${entry.room}` : "Room not assigned yet"}</p>
                    </button>
                  ))}
                </div>
              ) : null}
            </SectionCard>

            <SectionCard
              title={selectedClass ? `${selectedClass.subject_name} roster` : "Class roster"}
              description={
                selectedClass
                  ? "Review each student with a checkbox roster. Checked students are present, unchecked students are absent, and late can be applied explicitly."
                  : "Select a class from your daily list to load the roster."
              }
            >
              {!selectedClass ? (
                <EmptyState
                  title="Choose a class first"
                  description="The roster and attendance controls will appear here once you open one of your assigned timetable slots."
                />
              ) : loadingRoster ? (
                <p className="text-sm text-slate-500">Loading class roster...</p>
              ) : classStudents.length === 0 ? (
                <EmptyState
                  title="No students found for this class"
                  description="This timetable entry does not currently match any students in the selected department, batch, and semester."
                />
              ) : (
                <form className="space-y-5" onSubmit={submitRosterAttendance}>
                  <div className="grid gap-4 md:grid-cols-3">
                    <StatCard label="Selected date" value={formatDate(selectedDate)} />
                    <StatCard label="Students in class" value={classStudents.length} />
                    <StatCard label="Subject" value={selectedClass.subject_name} />
                  </div>
                  <p className="text-sm text-slate-500">Default status loads from existing attendance for that date when available, otherwise it starts as present for quick review.</p>
                  <div className="flex flex-wrap gap-3">
                    <ActionButton type="button" variant="secondary" onClick={() => setAllRosterStatuses("present")}>
                      Mark all
                    </ActionButton>
                    <ActionButton type="button" variant="secondary" onClick={() => setAllRosterStatuses("absent")}>
                      Unmark all
                    </ActionButton>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">Student</th>
                          <th className="px-4 py-3 font-medium">Enrollment number</th>
                          <th className="px-4 py-3 font-medium">Department</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {classStudents.map((student) => {
                          const currentStatus = attendanceDraft[student.id] || "present";
                          return (
                            <tr key={student.id}>
                              <td className="px-4 py-4">
                                <div>
                                  <p className="font-medium text-slate-900">{student.name}</p>
                                  <p className="text-xs text-slate-500">Semester {student.semester}</p>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-slate-600">{student.enrollment_number}</td>
                              <td className="px-4 py-4 text-slate-600">{student.department}</td>
                              <td className="px-4 py-4">
                                <div className="flex flex-wrap items-center gap-3">
                                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={currentStatus !== "absent"}
                                      onChange={(event) =>
                                        setAttendanceDraft((current) => ({
                                          ...current,
                                          [student.id]: event.target.checked ? "present" : "absent",
                                        }))
                                      }
                                      className="h-4 w-4 rounded border-slate-300 p-0"
                                    />
                                    Present
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAttendanceDraft((current) => ({
                                        ...current,
                                        [student.id]: currentStatus === "late" ? "present" : "late",
                                      }))
                                    }
                                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-amber-200 hover:bg-amber-50"
                                  >
                                    {currentStatus === "late" ? "Clear late" : "Late"}
                                  </button>
                                  <Badge tone={statusToneMap[currentStatus]}>{currentStatus}</Badge>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <ActionButton type="submit" disabled={savingRoster}>{savingRoster ? "Submitting..." : "Submit attendance"}</ActionButton>
                </form>
              )}
            </SectionCard>
          </section>
        ) : (
          <>
            <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
              <SectionCard title="Attendance permissions" description="Teachers are the only role that can submit attendance records.">
                <EmptyState
                  title="Attendance marking is teacher-only"
                  description="This screen still lets you review student attendance history and subject percentages using the data already saved in the database."
                />
              </SectionCard>

              <SectionCard title="Attendance insights" description="Enter a student and subject to review attendance percentage and detailed history.">
                <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => void loadHistory(event)}>
                  <input type="number" min={1} value={lookupStudentId} onChange={(event) => setLookupStudentId(event.target.value)} placeholder="Student ID" disabled={isStudentUser} />
                  <input type="number" min={1} value={lookupSubjectId} onChange={(event) => setLookupSubjectId(event.target.value)} placeholder="Subject ID (optional)" />
                  <ActionButton type="submit" disabled={loadingHistory}>{loadingHistory ? "Loading..." : "View insights"}</ActionButton>
                </form>
                {isStudentUser && myProfile ? <p className="mt-3 text-sm text-slate-500">Bound to your profile: {myProfile.name} ({myProfile.enrollment_number})</p> : null}

                {percentage ? (
                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <StatCard label="Total classes" value={percentage.total_classes} />
                    <StatCard label="Attended classes" value={percentage.attended_classes} />
                    <StatCard label="Attendance percentage" value={`${percentage.attendance_percentage}%`} />
                  </div>
                ) : null}
              </SectionCard>
            </section>

            <SectionCard title="Attendance history" description="Recent records for the selected student, filtered to the subject entered above when applicable.">
              {loadingHistory ? <p className="text-sm text-slate-500">Loading attendance history...</p> : null}
              {!loadingHistory && filteredHistory.length === 0 ? (
                <EmptyState
                  title="No attendance records yet"
                  description="Run an attendance lookup to populate this history table."
                />
              ) : null}
              {filteredHistory.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Student ID</th>
                        <th className="px-4 py-3 font-medium">Subject ID</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredHistory.map((record) => (
                        <tr key={record.id}>
                          <td className="px-4 py-4 text-slate-600">{formatDate(record.date)}</td>
                          <td className="px-4 py-4 text-slate-600">{record.student_id}</td>
                          <td className="px-4 py-4 text-slate-600">{record.subject_id}</td>
                          <td className="px-4 py-4">
                            <Badge tone={statusToneMap[record.status]}>{record.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </SectionCard>
          </>
        )}
      </AppLayout>
    </>
  );
};

export default AttendancePage;
