import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppLayout } from "../components/AppLayout";
import { Notice, PageIntro, SectionCard, StatCard } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { AcademicOverview, Holiday, TimetableEntry, UserRole } from "../lib/types";
import { formatDate, formatLabel, formatTime, getErrorMessage } from "../lib/utils";

const roleCopy: Record<UserRole, { eyebrow: string; summary: string; links: { href: string; label: string; description: string }[] }> = {
  admin: {
    eyebrow: "Administrator overview",
    summary: "Oversee structure, user access, department coverage, and the shared data flow that powers daily academic operations.",
    links: [
      { href: "/departments", label: "Manage departments", description: "Keep the academic structure aligned before creating students, faculty, and subjects." },
      { href: "/admin/users", label: "Provision users", description: "Create accounts for staff and students and connect them into the institution model." },
      { href: "/timetable", label: "Plan timetable", description: "Organize weekly schedule, teacher allocation, and holiday context." },
    ],
  },
  teacher: {
    eyebrow: "Teaching operations",
    summary: "Use the same connected data chain to move from assigned classes into attendance, student monitoring, and timetable-based execution.",
    links: [
      { href: "/attendance", label: "Mark attendance", description: "Open your linked classes and submit attendance for the right subject and cohort." },
      { href: "/students", label: "Review students", description: "See the students who share your department and class structure." },
      { href: "/timetable", label: "View schedule", description: "Check the timetable built from subject and faculty allocations." },
    ],
  },
  student: {
    eyebrow: "Student workspace",
    summary: "Your dashboard is now driven by your own department, batch, semester, timetable, attendance, and result records.",
    links: [
      { href: "/students", label: "Open my profile", description: "Review your personal academic record and enrollment details." },
      { href: "/attendance", label: "Check attendance", description: "See your own attendance history and percentage only." },
      { href: "/timetable", label: "View schedule", description: "Open the timetable tied to your class, semester, and department." },
    ],
  },
};

const DashboardPage = () => {
  const { user } = useAuth();
  const [overview, setOverview] = useState<AcademicOverview | null>(null);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
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
        setOverview(overviewResponse.data);
        setTimetable(timetableResponse.data);
        setHolidays(holidaysResponse.data);
      } catch (loadError) {
        setError(getErrorMessage(loadError, "Failed to load dashboard data"));
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, [user?.role]);

  const todayName = useMemo(
    () => new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date()).toLowerCase(),
    [],
  );
  const copy = roleCopy[(user?.role || "student") as UserRole];
  const todaysSchedule = timetable.filter((entry) => entry.day === todayName);
  const personal = overview?.personal;
  const visibleModules = overview?.modules.length || 0;

  return (
    <>
      <Head>
        <title>Dashboard | StudentMS</title>
      </Head>
      <AppLayout title="Dashboard">
        <PageIntro eyebrow={copy.eyebrow} title="Role-aware academic operations" description={copy.summary} />

        {error ? <Notice tone="danger">{error}</Notice> : null}

        <section className="hero-panel relative p-6 sm:p-8">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-100">Live academic pulse</p>
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-white">
                One role-aware workspace tied directly to your real timetable, departments, and academic records.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-slate-200">
                The backend overview, timetable, and holiday APIs are driving this screen in real time so each role sees the right operational slice.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[28px] border border-white/10 bg-white/10 p-4">
                <p className="text-sm text-slate-300">Visible modules</p>
                <p className="mt-2 text-3xl font-semibold text-white">{loading ? "..." : visibleModules}</p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/10 p-4">
                <p className="text-sm text-slate-300">Today&apos;s classes</p>
                <p className="mt-2 text-3xl font-semibold text-white">{loading ? "..." : personal?.today_class_count ?? todaysSchedule.length}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Your role" value={formatLabel(user?.role || "student")} hint={user?.email} />
          <StatCard
            label={user?.role === "student" ? "Attendance %" : "Student records"}
            value={loading ? "..." : user?.role === "student" ? `${personal?.overall_attendance_percentage ?? 0}%` : overview?.metrics.student_count || 0}
            tone={user?.role === "student" ? "success" : "brand"}
            hint={user?.role === "student" ? "Calculated from your attendance history" : "Live count from the shared overview service"}
          />
          <StatCard
            label="Timetable slots"
            value={loading ? "..." : user?.role === "admin" ? overview?.metrics.timetable_slot_count || 0 : personal?.timetable_slot_count || timetable.length}
            tone="warning"
            hint={`${personal?.today_class_count ?? todaysSchedule.length} scheduled for today`}
          />
          <StatCard label="Accessible modules" value={loading ? "..." : visibleModules} hint={user?.is_active ? "Account is active" : "Account is inactive"} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <SectionCard title="Quick actions" description="Jump straight into the workflows used most often for your role.">
            <div className="grid gap-4 md:grid-cols-3">
              {copy.links.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-brand-200 hover:bg-brand-50">
                  <p className="text-base font-semibold text-slate-950">{link.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{link.description}</p>
                </Link>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Today at a glance" description="Current schedule and academic-calendar context from the live timetable APIs.">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-500">Today&apos;s schedule</p>
                {loading ? <p className="mt-2 text-sm text-slate-500">Loading schedule...</p> : null}
                {!loading && todaysSchedule.length === 0 ? <p className="mt-2 text-sm text-slate-500">No timetable entries scheduled for today.</p> : null}
                <div className="mt-3 space-y-3">
                  {todaysSchedule.map((entry) => (
                    <div key={entry.id} className="rounded-2xl bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">{entry.subject_name}</p>
                      <p className="mt-1 text-sm text-slate-500">{formatTime(entry.start_time)} to {formatTime(entry.end_time)}</p>
                      <p className="mt-2 text-xs text-slate-500">{entry.department} / {entry.batch_year} batch / Semester {entry.semester}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-500">Next holiday</p>
                {loading ? <p className="mt-2 text-sm text-slate-500">Loading holidays...</p> : null}
                {!loading && holidays[0] ? (
                  <>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{holidays[0].description}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatDate(holidays[0].date)}</p>
                  </>
                ) : null}
                {!loading && !holidays[0] ? <p className="mt-2 text-sm text-slate-500">No holidays have been added yet.</p> : null}
              </div>
            </div>
          </SectionCard>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <SectionCard title="Connected academic structure" description="These counts verify the shared flow from department setup into teachers, students, subjects, and timetable execution.">
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Department</th>
                    <th className="px-4 py-3 font-medium">Students</th>
                    <th className="px-4 py-3 font-medium">Teachers</th>
                    <th className="px-4 py-3 font-medium">Subjects</th>
                    <th className="px-4 py-3 font-medium">Timetable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {loading ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-500" colSpan={5}>Loading department flow...</td>
                    </tr>
                  ) : null}
                  {!loading && (overview?.departments.length || 0) === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-slate-500" colSpan={5}>No department structure is available yet.</td>
                    </tr>
                  ) : null}
                  {(overview?.departments || []).slice(0, 6).map((department) => (
                    <tr key={department.id}>
                      <td className="px-4 py-4 font-medium text-slate-900">{department.name}</td>
                      <td className="px-4 py-4 text-slate-600">{department.student_count}</td>
                      <td className="px-4 py-4 text-slate-600">{department.faculty_count}</td>
                      <td className="px-4 py-4 text-slate-600">{department.subject_count}</td>
                      <td className="px-4 py-4 text-slate-600">{department.timetable_slot_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Dependency chain" description="This makes the backend data flow explicit across the system instead of leaving it implied.">
            <div className="space-y-3">
              {(overview?.dependency_flow || []).map((node) => (
                <div key={node.entity} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{node.entity}</p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">{node.live_records} live</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Upstream: {node.upstream.join(", ") || "None"}</p>
                  <p className="mt-1 text-xs text-slate-500">Downstream: {node.downstream.join(", ") || "None"}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </section>

        <SectionCard title="Role access map" description="The same academic data now flows through different permission levels without changing ownership boundaries.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(overview?.modules || []).map((module) => (
              <div key={module.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-950">{module.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{module.description}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {module.access_roles.map((role) => formatLabel(role)).join(" / ")}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      </AppLayout>
    </>
  );
};

export default DashboardPage;
