import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { AppLayout } from "../../components/AppLayout";
import { EmptyState, Notice, PageIntro, SectionCard } from "../../components/ui";
import { api } from "../../lib/api";
import { DepartmentSummary, StudentListResponse, Subject, TimetableEntry } from "../../lib/types";
import { formatLabel, formatTime, getErrorMessage } from "../../lib/utils";

const DepartmentDetailPage = () => {
  const router = useRouter();
  const departmentName = useMemo(() => {
    const raw = router.query.department;
    return typeof raw === "string" ? decodeURIComponent(raw) : "";
  }, [router.query.department]);

  const [department, setDepartment] = useState<DepartmentSummary | null>(null);
  const [students, setStudents] = useState<StudentListResponse["items"]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDepartment = async () => {
      if (!departmentName) {
        return;
      }
      setLoading(true);
      setError("");
      try {
        const departmentsResponse = await api.get<DepartmentSummary[]>("/departments");
        const matched = departmentsResponse.data.find((item) => item.name.toLowerCase() === departmentName.toLowerCase()) || null;
        setDepartment(matched);
        if (!matched) {
          setStudents([]);
          setSubjects([]);
          setTimetable([]);
          return;
        }

        const defaultBatch = matched.active_batches[0] || matched.batch_start_year;
        const defaultSemester = matched.active_semesters[0] || 1;
        setSelectedSemester(defaultSemester);

        const [studentsResponse, subjectsResponse, timetableResponse] = await Promise.all([
          api.get<StudentListResponse>("/students", {
            params: { page: 1, page_size: 50, department: matched.name, batch_year: defaultBatch },
          }),
          api.get<Subject[]>("/subjects", {
            params: { department: matched.name, batch_year: defaultBatch, semester: defaultSemester },
          }),
          api.get<TimetableEntry[]>("/timetable", {
            params: { department: matched.name, batch_year: defaultBatch, semester: defaultSemester },
          }),
        ]);

        setStudents(studentsResponse.data.items);
        setSubjects(subjectsResponse.data);
        setTimetable(timetableResponse.data);
      } catch (loadError) {
        setError(getErrorMessage(loadError, "Unable to load the department view"));
      } finally {
        setLoading(false);
      }
    };

    void loadDepartment();
  }, [departmentName]);

  useEffect(() => {
    const loadSemesterData = async () => {
      if (!department || !selectedSemester) {
        return;
      }
      const defaultBatch = department.active_batches[0] || department.batch_start_year;
      try {
        const [subjectsResponse, timetableResponse] = await Promise.all([
          api.get<Subject[]>("/subjects", {
            params: { department: department.name, batch_year: defaultBatch, semester: selectedSemester },
          }),
          api.get<TimetableEntry[]>("/timetable", {
            params: { department: department.name, batch_year: defaultBatch, semester: selectedSemester },
          }),
        ]);
        setSubjects(subjectsResponse.data);
        setTimetable(timetableResponse.data);
      } catch (loadError) {
        setError(getErrorMessage(loadError, "Unable to load semester data"));
      }
    };

    void loadSemesterData();
  }, [department, selectedSemester]);

  return (
    <>
      <Head>
        <title>{departmentName || "Department"} | StudentMS</title>
      </Head>
      <AppLayout title="Department Explorer">
        <PageIntro
          eyebrow="Connected navigation"
          title={department ? department.name : "Department"}
          description="Navigate from department to semester, then to subjects, students, and timetable in one connected flow."
        />

        {error ? <Notice tone="danger">{error}</Notice> : null}
        {loading ? <SectionCard title="Loading"><p className="text-sm text-slate-500">Building department graph...</p></SectionCard> : null}
        {!loading && !department ? <EmptyState title="Department not found" description="This department is not available or was renamed." /> : null}

        {department ? (
          <section className="space-y-6">
            <SectionCard title="Semesters" description="Pick a semester to scope related subjects and timetable slots.">
              <div className="flex flex-wrap gap-2">
                {department.active_semesters.map((semester) => (
                  <button
                    key={`${department.id}-${semester}`}
                    type="button"
                    onClick={() => setSelectedSemester(semester)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      selectedSemester === semester ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    Semester {semester}
                  </button>
                ))}
              </div>
            </SectionCard>

            <section className="grid gap-6 xl:grid-cols-2">
              <SectionCard title="Subjects" description="Subjects offered for the selected semester.">
                {subjects.length === 0 ? (
                  <EmptyState title="No subjects" description="No subjects are mapped to this semester yet." />
                ) : (
                  <div className="space-y-3">
                    {subjects.map((subject) => (
                      <div key={subject.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="font-semibold text-slate-900">{subject.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{subject.code || "Code pending"} | {formatLabel(subject.department)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Students" description="Students in this department and active batch.">
                {students.length === 0 ? (
                  <EmptyState title="No students" description="No students found for the selected department batch." />
                ) : (
                  <div className="space-y-3">
                    {students.slice(0, 20).map((student) => (
                      <Link
                        key={student.id}
                        href={{ pathname: "/students", query: { department: department.name, batch_year: student.batch_year } }}
                        className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-brand-200"
                      >
                        <p className="font-semibold text-slate-900">{student.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{student.enrollment_number} | Semester {student.semester}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </SectionCard>
            </section>

            <SectionCard title="Timetable" description="Scheduled slots for the selected semester.">
              {timetable.length === 0 ? (
                <EmptyState title="No timetable slots" description="No class slots are scheduled for this semester yet." />
              ) : (
                <div className="space-y-3">
                  {timetable.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="font-semibold text-slate-900">{entry.subject_name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatLabel(entry.day)} | {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </section>
        ) : null}
      </AppLayout>
    </>
  );
};

export default DepartmentDetailPage;

