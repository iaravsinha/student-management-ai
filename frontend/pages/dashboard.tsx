import Head from "next/head";
import { useEffect, useState } from "react";

import { AppLayout } from "../components/AppLayout";
import { DashboardHome } from "../components/dashboard/DashboardHome";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import type {
  AcademicOverview,
  AttendanceRecord,
  Holiday,
  ResultRecord,
  Student,
  Subject,
  SubjectAttendanceSnapshot,
  TimetableEntry,
} from "../lib/types";
import { getErrorMessage } from "../lib/utils";

const DashboardPage = () => {
  const { user } = useAuth();
  const [overview, setOverview] = useState<AcademicOverview | null>(null);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [subjectAttendance, setSubjectAttendance] = useState<SubjectAttendanceSnapshot[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError("");
      try {
        const [overviewResponse, timetableResponse, holidaysResponse] = await Promise.all([
          api.get<AcademicOverview>("/overview/academic"),
          api.get<TimetableEntry[]>("/timetable"),
          api.get<Holiday[]>("/timetable/holidays"),
        ]);

        let studentSubjectAttendance: SubjectAttendanceSnapshot[] = [];
        let studentRecentAttendance: AttendanceRecord[] = [];

        if (user?.role === "student") {
          const student = await api.get<Student>("/students/me").then((response) => response.data);
          const [attendanceResponse, resultsResponse, subjectsResponse] = await Promise.all([
            api.get<AttendanceRecord[]>(`/attendance/student/${student.id}`),
            api.get<ResultRecord[]>(`/results/student/${student.id}`),
            api.get<Subject[]>("/subjects", {
              params: {
                department: student.department,
                batch_year: student.batch_year,
              },
            }),
          ]);

          const subjectNames = new Map<number, { name: string; semester?: number | null }>();
          subjectsResponse.data.forEach((subject) => subjectNames.set(subject.id, { name: subject.name, semester: subject.semester }));
          timetableResponse.data.forEach((entry) => subjectNames.set(entry.subject_id, { name: entry.subject_name, semester: entry.semester }));
          resultsResponse.data.forEach((record) => {
            if (!subjectNames.has(record.subject_id)) {
              subjectNames.set(record.subject_id, { name: record.subject_name, semester: null });
            }
          });

          const grouped = new Map<number, { total: number; attended: number; absent: number }>();
          attendanceResponse.data.forEach((record) => {
            const current = grouped.get(record.subject_id) || { total: 0, attended: 0, absent: 0 };
            current.total += 1;
            if (record.status === "absent") {
              current.absent += 1;
            } else {
              current.attended += 1;
            }
            grouped.set(record.subject_id, current);
          });

          studentSubjectAttendance = Array.from(grouped.entries())
            .map(([subjectId, stats]) => ({
              subjectId,
              name: subjectNames.get(subjectId)?.name || `Subject ${subjectId}`,
              semester: subjectNames.get(subjectId)?.semester ?? null,
              total: stats.total,
              attended: stats.attended,
              absent: stats.absent,
              percentage: stats.total ? Math.round((stats.attended / stats.total) * 100) : 0,
            }))
            .sort((left, right) => left.percentage - right.percentage);
            
          studentRecentAttendance = attendanceResponse.data
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 5);
        }

        setOverview(overviewResponse.data);
        setTimetable(timetableResponse.data);
        setHolidays(holidaysResponse.data);
        setSubjectAttendance(studentSubjectAttendance);
        setRecentAttendance(studentRecentAttendance);
      } catch (loadError) {
        setError(getErrorMessage(loadError, "Failed to load dashboard data"));
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, [user?.role]);

  return (
    <>
      <Head>
        <title>Dashboard | StudentMS</title>
      </Head>
      <AppLayout title="Dashboard">
        <DashboardHome
          user={user}
          overview={overview}
          timetable={timetable}
          holidays={holidays}
          subjectAttendance={subjectAttendance}
          recentAttendance={recentAttendance}
          loading={loading}
          error={error}
        />
      </AppLayout>
    </>
  );
};

export default DashboardPage;
