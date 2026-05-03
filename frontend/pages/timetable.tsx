import Head from "next/head";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { AppLayout } from "../components/AppLayout";
import { ActionButton, EmptyState, Notice, PageIntro, SectionCard } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { getDepartmentOption } from "../lib/academic";
import { api } from "../lib/api";
import { useDepartmentCatalog } from "../lib/useDepartmentCatalog";
import { FacultyProfile, Holiday, HolidayPayload, Subject, SubjectPayload, TimetableEntry, WeekDay, WeeklyTimetablePayload } from "../lib/types";
import { WEEK_DAYS, addMinutesToTime, formatDate, formatLabel, formatTime, getErrorMessage, getLocalDateInputValue } from "../lib/utils";

const defaultRows = ["09:00", "09:45", "10:30", "11:15", "12:00", "12:45", "13:30", "14:15", "15:00"];
const plannerDays = WEEK_DAYS;

const emptyHolidayForm: HolidayPayload = {
  date: getLocalDateInputValue(),
  description: "",
};

const emptySubjectForm = (department = "", batchYear = new Date().getFullYear(), semester = 1): SubjectPayload => ({
  name: "",
  code: "",
  syllabus: "",
  department,
  batch_year: batchYear,
  semester,
});

type PlannerCell = {
  subject_id: string;
  faculty_user_id: string;
  room: string;
};

const emptyCell = (): PlannerCell => ({
  subject_id: "",
  faculty_user_id: "",
  room: "",
});

const cellKey = (day: WeekDay, startTime: string) => `${day}-${startTime}`;

const TimetablePage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const canManage = user?.role === "admin";
  const { catalog, fallbackDepartment, loading: departmentsLoading, error: departmentsError } = useDepartmentCatalog(
    true,
  );
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [faculty, setFaculty] = useState<FacultyProfile[]>([]);
  const [batchSubjects, setBatchSubjects] = useState<Subject[]>([]);
  const [department, setDepartment] = useState("");
  const [batchYear, setBatchYear] = useState<number>(new Date().getFullYear());
  const [semester, setSemester] = useState(1);
  const [holidayForm, setHolidayForm] = useState<HolidayPayload>(emptyHolidayForm);
  const [subjectForm, setSubjectForm] = useState<SubjectPayload>(emptySubjectForm());
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [plannerRows, setPlannerRows] = useState<string[]>(defaultRows);
  const [plannerCells, setPlannerCells] = useState<Record<string, PlannerCell>>({});
  const [newRowTime, setNewRowTime] = useState("15:45");
  const [loading, setLoading] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [savingWeekly, setSavingWeekly] = useState(false);
  const [submittingHoliday, setSubmittingHoliday] = useState(false);
  const [submittingSubject, setSubmittingSubject] = useState(false);
  const [deletingSubjectId, setDeletingSubjectId] = useState<number | null>(null);

  const departmentConfig = useMemo(
    () => getDepartmentOption(catalog, department) || fallbackDepartment,
    [catalog, department, fallbackDepartment],
  );
  const filteredFaculty = useMemo(() => faculty.filter((profile) => profile.department === department), [faculty, department]);
  const subjects = useMemo(
    () => batchSubjects.filter((subject) => subject.semester === semester),
    [batchSubjects, semester],
  );
  const subjectsBySemester = useMemo(() => {
    const grouped = new Map<number, Subject[]>();
    for (const subject of batchSubjects) {
      const current = grouped.get(subject.semester) || [];
      current.push(subject);
      grouped.set(subject.semester, current);
    }
    return Array.from(grouped.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([value, semesterSubjects]) => ({
        semester: value,
        subjects: semesterSubjects.sort((left, right) => left.name.localeCompare(right.name)),
      }));
  }, [batchSubjects]);
  const groupedEntries = useMemo(() => plannerDays.map((day) => ({ day, entries: entries.filter((entry) => entry.day === day) })), [entries]);

  useEffect(() => {
    if (!router.isReady || !fallbackDepartment) {
      return;
    }
    const queryDepartment = typeof router.query.department === "string" ? router.query.department : fallbackDepartment.name;
    const config = getDepartmentOption(catalog, queryDepartment) || fallbackDepartment;
    const queryBatchYear = typeof router.query.batch_year === "string" ? Number(router.query.batch_year) : config.batches[0];
    setDepartment(config.name);
    setBatchYear(config.batches.includes(queryBatchYear) ? queryBatchYear : config.batches[0]);
    setSemester(config.semesters[0]);
  }, [catalog, fallbackDepartment, router.isReady, router.query.batch_year, router.query.department]);

  useEffect(() => {
    if (!fallbackDepartment) {
      return;
    }
    if (!department) {
      setDepartment(fallbackDepartment.name);
      setBatchYear(fallbackDepartment.batches[0]);
      setSemester(fallbackDepartment.semesters[0]);
    }
  }, [department, fallbackDepartment]);

  useEffect(() => {
    setSubjectForm(emptySubjectForm(department, batchYear, semester));
    setEditingSubjectId(null);
  }, [department, batchYear, semester]);

  const loadTimetable = async () => {
    if (!department) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const timetableParams = canManage ? { department, batch_year: batchYear, semester } : undefined;
      const [entriesResponse, holidaysResponse] = await Promise.all([
        api.get<TimetableEntry[]>("/timetable", { params: timetableParams }),
        api.get<Holiday[]>("/timetable/holidays"),
      ]);
      setEntries(entriesResponse.data);
      setHolidays(holidaysResponse.data);
      if (canManage) {
        const facultyResponse = await api.get<FacultyProfile[]>("/faculty");
        setFaculty(facultyResponse.data);
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load timetable data"));
    } finally {
      setLoading(false);
    }
  };

  const loadSubjects = async () => {
    if (!department) {
      return;
    }
    setLoadingSubjects(true);
    try {
      const response = await api.get<Subject[]>("/subjects", {
        params: { department, batch_year: batchYear },
      });
      setBatchSubjects(response.data);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load subjects for the selected batch"));
      setBatchSubjects([]);
    } finally {
      setLoadingSubjects(false);
    }
  };

  useEffect(() => {
    void loadTimetable();
  }, [canManage, department, batchYear, semester, user?.role]);

  useEffect(() => {
    void loadSubjects();
  }, [department, batchYear]);

  useEffect(() => {
    if (batchSubjects.length === 0) {
      return;
    }
    const semestersWithData = Array.from(new Set(batchSubjects.map((subject) => subject.semester))).sort((left, right) => right - left);
    if (!semestersWithData.includes(semester)) {
      setSemester(semestersWithData[0]);
    }
  }, [batchSubjects, semester]);

  useEffect(() => {
    if (!canManage) {
      return;
    }
    const rowTimes = Array.from(new Set([...defaultRows, ...entries.map((entry) => entry.start_time.slice(0, 5))])).sort();
    const nextCells: Record<string, PlannerCell> = {};
    for (const row of rowTimes) {
      for (const day of plannerDays) {
        nextCells[cellKey(day, row)] = emptyCell();
      }
    }
    for (const entry of entries) {
      nextCells[cellKey(entry.day, entry.start_time.slice(0, 5))] = {
        subject_id: String(entry.subject_id),
        faculty_user_id: entry.faculty_user_id ? String(entry.faculty_user_id) : "",
        room: entry.room || "",
      };
    }
    setPlannerRows(rowTimes);
    setPlannerCells(nextCells);
  }, [canManage, entries]);

  const setPlannerCell = (day: WeekDay, startTime: string, next: Partial<PlannerCell>) => {
    const key = cellKey(day, startTime);
    setPlannerCells((current) => ({
      ...current,
      [key]: {
        ...(current[key] || emptyCell()),
        ...next,
      },
    }));
  };

  const addRow = () => {
    if (!newRowTime || plannerRows.includes(newRowTime)) {
      return;
    }
    const nextRows = [...plannerRows, newRowTime].sort();
    const nextCells = { ...plannerCells };
    for (const day of plannerDays) {
      nextCells[cellKey(day, newRowTime)] = emptyCell();
    }
    setPlannerRows(nextRows);
    setPlannerCells(nextCells);
    setNewRowTime(addMinutesToTime(newRowTime, 45).slice(0, 5));
  };

  const removeRow = (startTime: string) => {
    setPlannerRows((current) => current.filter((row) => row !== startTime));
    setPlannerCells((current) => {
      const next = { ...current };
      for (const day of plannerDays) {
        delete next[cellKey(day, startTime)];
      }
      return next;
    });
  };

  const autoGenerateWeek = () => {
    if (subjects.length === 0) {
      return;
    }
    const defaultFacultyId = filteredFaculty[0]?.user_id ? String(filteredFaculty[0].user_id) : "";
    const nextCells: Record<string, PlannerCell> = {};
    let subjectIndex = 0;

    for (const row of plannerRows) {
      for (const day of plannerDays) {
        const shouldSchedule = day !== "sunday" && (subjectIndex < subjects.length || row < "13:00");
        if (!shouldSchedule) {
          nextCells[cellKey(day, row)] = emptyCell();
          continue;
        }
        const subject = subjects[subjectIndex % subjects.length];
        nextCells[cellKey(day, row)] = {
          subject_id: String(subject.id),
          faculty_user_id: defaultFacultyId,
          room: plannerCells[cellKey(day, row)]?.room || "",
        };
        subjectIndex += 1;
      }
    }

    setPlannerCells(nextCells);
    setFeedback("A suggested repeating week has been generated. Review it and save when ready.");
  };

  const saveWeeklyPlanner = async () => {
    setSavingWeekly(true);
    setError("");
    setFeedback("");
    try {
      const payload: WeeklyTimetablePayload = {
        department,
        batch_year: batchYear,
        semester,
        slots: plannerRows.flatMap((row) =>
          plannerDays.map((day) => {
            const cell = plannerCells[cellKey(day, row)] || emptyCell();
            return {
              day,
              start_time: `${row}:00`,
              subject_id: cell.subject_id ? Number(cell.subject_id) : null,
              faculty_user_id: cell.subject_id && cell.faculty_user_id ? Number(cell.faculty_user_id) : null,
              room: cell.room || null,
            };
          }),
        ),
      };
      await api.put<TimetableEntry[]>("/timetable/weekly", payload);
      setFeedback("Repeating weekly schedule saved successfully.");
      await loadTimetable();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Unable to save weekly schedule"));
    } finally {
      setSavingWeekly(false);
    }
  };

  const handleCreateHoliday = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittingHoliday(true);
    setError("");
    setFeedback("");
    try {
      await api.post<Holiday>("/timetable/holidays", holidayForm);
      setFeedback("Holiday created successfully.");
      setHolidayForm(emptyHolidayForm);
      await loadTimetable();
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Unable to create holiday"));
    } finally {
      setSubmittingHoliday(false);
    }
  };

  const handleSubjectSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittingSubject(true);
    setError("");
    setFeedback("");
    try {
      if (editingSubjectId) {
        await api.put(`/subjects/${editingSubjectId}`, subjectForm);
        setFeedback("Subject updated for the selected batch.");
      } else {
        await api.post("/subjects", subjectForm);
        setFeedback("Subject added for the selected batch.");
      }
      setSubjectForm(emptySubjectForm(department, batchYear, semester));
      setEditingSubjectId(null);
      await loadSubjects();
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Unable to save subject"));
    } finally {
      setSubmittingSubject(false);
    }
  };

  const handleEditSubject = (subject: Subject) => {
    setEditingSubjectId(subject.id);
    setSubjectForm({
      name: subject.name,
      code: subject.code || "",
      syllabus: subject.syllabus || "",
      department: subject.department,
      batch_year: subject.batch_year,
      semester: subject.semester,
    });
  };

  const handleDeleteSubject = async (subjectId: number) => {
    setDeletingSubjectId(subjectId);
    setError("");
    setFeedback("");
    try {
      await api.delete(`/subjects/${subjectId}`);
      if (editingSubjectId === subjectId) {
        setEditingSubjectId(null);
        setSubjectForm(emptySubjectForm(department, batchYear, semester));
      }
      setFeedback("Subject deleted from the selected batch.");
      await loadSubjects();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Unable to delete subject"));
    } finally {
      setDeletingSubjectId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Timetable | StudentMS</title>
      </Head>
      <AppLayout title="Timetable">
        <PageIntro
          eyebrow="Academic schedule"
          title="Repeating weekly timetable planner"
          description="Plan the whole week in 45-minute slots. Leave any slot vacant or assign a subject, faculty, and room, and the saved week will automatically feed student views, teacher views, and attendance availability."
        />

        {departmentsError ? <Notice tone="danger">{departmentsError}</Notice> : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {feedback ? <Notice tone="success">{feedback}</Notice> : null}

        {departmentsLoading ? (
          <SectionCard title="Loading timetable scope" description="Fetching live departments, batches, and semesters.">
            <p className="text-sm text-slate-500">Preparing the academic planner...</p>
          </SectionCard>
        ) : !fallbackDepartment ? (
          <SectionCard title="Departments required" description="The timetable planner uses live department data from the backend.">
            <EmptyState
              title="Create a department first"
              description="Once at least one department exists, this page can scope timetable planning, subjects, and holidays to real academic data."
            />
          </SectionCard>
        ) : (
        <>

        <section className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
          <SectionCard title="Weekly timetable" description="Grouped by weekday from the live scoped timetable API.">
            <div className="grid gap-4 md:grid-cols-2">
              {groupedEntries.map((group) => (
                <div key={group.day} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-semibold text-slate-950">{formatLabel(group.day)}</p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">{group.entries.length} classes</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {loading ? <p className="text-sm text-slate-500">Loading...</p> : null}
                    {!loading && group.entries.length === 0 ? <p className="text-sm text-slate-500">No classes scheduled.</p> : null}
                    {group.entries.map((entry) => (
                      <div key={entry.id} className="rounded-2xl bg-white p-4">
                        <p className="font-semibold text-slate-900">{entry.subject_name}</p>
                        <p className="mt-1 text-sm text-slate-500">{entry.department} - {entry.batch_year} batch - Semester {entry.semester}</p>
                        <p className="mt-1 text-sm text-slate-500">{formatTime(entry.start_time)} to {formatTime(entry.end_time)}{entry.room ? ` - Room ${entry.room}` : ""}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="space-y-6">
            <SectionCard title="Batch subject catalog" description="Choose a department, batch, and semester, then add, edit, or delete the subjects available to that academic group.">
              <div className="grid gap-4 md:grid-cols-3">
                <select value={department} onChange={(event) => {
                  const config = getDepartmentOption(catalog, event.target.value) || fallbackDepartment;
                  if (!config) {
                    return;
                  }
                  setDepartment(config.name);
                  setBatchYear(config.batches[0]);
                  setSemester(config.semesters[0]);
                }}>
                  {catalog.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}
                </select>
                <select value={batchYear} onChange={(event) => setBatchYear(Number(event.target.value))}>
                  {(departmentConfig?.batches || []).map((batch) => <option key={batch} value={batch}>{batch} batch</option>)}
                </select>
                <select value={semester} onChange={(event) => setSemester(Number(event.target.value))}>
                  {(departmentConfig?.semesters || []).map((value) => <option key={value} value={value}>Semester {value}</option>)}
                </select>
              </div>

              <div className="mt-5 space-y-3">
                {loadingSubjects ? <p className="text-sm text-slate-500">Loading subjects...</p> : null}
                {!loadingSubjects && batchSubjects.length === 0 ? <p className="text-sm text-slate-500">No subjects added for this batch yet.</p> : null}
                {!loadingSubjects && batchSubjects.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    {batchSubjects.length} subjects found for the {batchYear} batch. The planner below is currently set to Semester {semester}.
                  </div>
                ) : null}
                {subjectsBySemester.map((group) => (
                  <div key={group.semester} className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Semester {group.semester}</p>
                      {group.semester === semester ? <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">Planner semester</span> : null}
                    </div>
                    {group.subjects.map((subject) => (
                      <div key={subject.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{subject.name}</p>
                          <p className="mt-1 text-sm text-slate-500">{subject.code || "No code"} - {subject.department} - {subject.batch_year} batch - Semester {subject.semester}</p>
                          {subject.syllabus ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{subject.syllabus}</p> : null}
                        </div>
                        {canManage ? (
                          <div className="flex gap-2">
                            <ActionButton type="button" variant="secondary" onClick={() => handleEditSubject(subject)}>Edit</ActionButton>
                            <ActionButton type="button" variant="danger" disabled={deletingSubjectId === subject.id} onClick={() => void handleDeleteSubject(subject.id)}>
                              {deletingSubjectId === subject.id ? "Deleting..." : "Delete"}
                            </ActionButton>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {canManage ? (
                <form className="mt-6 space-y-4 border-t border-slate-200 pt-6" onSubmit={handleSubjectSubmit}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <input value={subjectForm.name} onChange={(event) => setSubjectForm((current) => ({ ...current, name: event.target.value }))} placeholder="Subject name" />
                    <input value={subjectForm.code || ""} onChange={(event) => setSubjectForm((current) => ({ ...current, code: event.target.value }))} placeholder="Subject code" />
                  </div>
                  <textarea
                    value={subjectForm.syllabus || ""}
                    onChange={(event) => setSubjectForm((current) => ({ ...current, syllabus: event.target.value }))}
                    placeholder="Syllabus outline, units, or outcomes"
                    rows={4}
                  />
                  <div className="flex flex-wrap gap-3">
                    <ActionButton type="submit" disabled={submittingSubject}>{submittingSubject ? "Saving..." : editingSubjectId ? "Update subject" : "Add subject"}</ActionButton>
                    {editingSubjectId ? <ActionButton type="button" variant="secondary" onClick={() => { setEditingSubjectId(null); setSubjectForm(emptySubjectForm(department, batchYear, semester)); }}>Cancel edit</ActionButton> : null}
                  </div>
                </form>
              ) : null}
            </SectionCard>

            <SectionCard title="Institution holidays" description="Holiday dates visible to all roles, created by admins.">
              <div className="space-y-3">
                {loading ? <p className="text-sm text-slate-500">Loading holidays...</p> : null}
                {!loading && holidays.length === 0 ? <p className="text-sm text-slate-500">No holidays have been added yet.</p> : null}
                {holidays.map((holiday) => <div key={holiday.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="font-semibold text-slate-900">{holiday.description}</p><p className="mt-1 text-sm text-slate-500">{formatDate(holiday.date)}</p></div>)}
              </div>

              {canManage ? (
                <form className="mt-6 space-y-4 border-t border-slate-200 pt-6" onSubmit={handleCreateHoliday}>
                  <input type="date" value={holidayForm.date} onChange={(event) => setHolidayForm((current) => ({ ...current, date: event.target.value }))} />
                  <input value={holidayForm.description} onChange={(event) => setHolidayForm((current) => ({ ...current, description: event.target.value }))} placeholder="Holiday description" />
                  <ActionButton type="submit" disabled={submittingHoliday}>{submittingHoliday ? "Saving..." : "Add holiday"}</ActionButton>
                </form>
              ) : null}
            </SectionCard>
          </div>
        </section>

        {canManage ? (
          <SectionCard
            title="Weekly planner"
            description="Set the repeating week for this batch. Each row is a 45-minute slot and each day can have a different subject or remain vacant."
            actions={
              <div className="flex flex-wrap gap-3">
                <ActionButton type="button" variant="secondary" onClick={autoGenerateWeek}>Auto-generate week</ActionButton>
                <ActionButton type="button" onClick={() => void saveWeeklyPlanner()} disabled={savingWeekly}>{savingWeekly ? "Saving..." : "Save weekly schedule"}</ActionButton>
              </div>
            }
          >
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Weekly schedule scope: {department} - {batchYear} batch - Semester {semester}. Teachers and students pick up this repeating schedule automatically, and teacher attendance opens only for the classes assigned here.</div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <input type="time" step={60} value={newRowTime} onChange={(event) => setNewRowTime(event.target.value)} />
              <ActionButton type="button" variant="secondary" onClick={addRow}>Add 45-minute row</ActionButton>
            </div>
            {subjects.length === 0 ? <EmptyState title="Add subjects first" description="Create at least one subject for this batch before filling the weekly planner." /> : null}
            {subjects.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-3 font-medium">Time</th>
                      {plannerDays.map((day) => <th key={day} className="min-w-[220px] px-3 py-3 font-medium">{formatLabel(day)}</th>)}
                      <th className="px-3 py-3 font-medium">Row</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white align-top">
                    {plannerRows.map((row) => (
                      <tr key={row}>
                        <td className="px-3 py-4 text-slate-600">
                          <div>
                            <p className="font-medium text-slate-900">{formatTime(`${row}:00`)}</p>
                            <p className="text-xs text-slate-500">to {formatTime(addMinutesToTime(row, 45))}</p>
                          </div>
                        </td>
                        {plannerDays.map((day) => {
                          const key = cellKey(day, row);
                          const cell = plannerCells[key] || emptyCell();
                          return (
                            <td key={key} className="px-3 py-4">
                              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <select
                                  value={cell.subject_id}
                                  onChange={(event) => {
                                    const nextSubjectId = event.target.value;
                                    setPlannerCell(day, row, {
                                      subject_id: nextSubjectId,
                                      faculty_user_id: nextSubjectId ? cell.faculty_user_id || String(filteredFaculty[0]?.user_id || "") : "",
                                    });
                                  }}
                                >
                                  <option value="">Vacant slot</option>
                                  {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                                </select>
                                <select
                                  value={cell.faculty_user_id}
                                  onChange={(event) => setPlannerCell(day, row, { faculty_user_id: event.target.value })}
                                  disabled={!cell.subject_id}
                                >
                                  <option value="">Select faculty</option>
                                  {filteredFaculty.map((profile) => <option key={profile.id} value={profile.user_id}>{profile.name}</option>)}
                                </select>
                                <input
                                  value={cell.room}
                                  onChange={(event) => setPlannerCell(day, row, { room: event.target.value })}
                                  placeholder="Room"
                                  disabled={!cell.subject_id}
                                />
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-3 py-4">
                          <ActionButton type="button" variant="ghost" onClick={() => removeRow(row)}>Remove</ActionButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </SectionCard>
        ) : null}
        </>
        )}
      </AppLayout>
    </>
  );
};

export default TimetablePage;
