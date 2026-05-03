import Link from "next/link";
import { useMemo } from "react";

import { Notice, PageIntro, SectionCard } from "../ui";
import type { AcademicOverview, Holiday, SubjectAttendanceSnapshot, TimetableEntry, User, UserRole } from "../../lib/types";
import { formatDate, formatLabel, formatTime } from "../../lib/utils";
import {
  ActionTile,
  AttendanceRing,
  BarDistribution,
  FlowPipeline,
  KpiTile,
  ScheduleBlock,
  SkeletonBlock,
  WeekStrip,
} from "./widgets";

const WEEK_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

const roleIntro: Record<UserRole, { eyebrow: string; title: string; summary: string }> = {
  admin: {
    eyebrow: "Administrator overview",
    title: "Institution pulse & coverage",
    summary:
      "Live counts across departments, people, timetable density, and academic artifacts—prioritize structure before daily execution.",
  },
  teacher: {
    eyebrow: "Teaching cockpit",
    title: "Classes, cohorts, and momentum",
    summary:
      "Your day is anchored on the live timetable—jump into attendance and student context without losing the weekly rhythm.",
  },
  student: {
    eyebrow: "Student home",
    title: "Your academic snapshot",
    summary:
      "Personal attendance, upcoming classes, and calendar context stay in one glanceable surface tied to your enrollment.",
  },
};

const roleActions: Record<UserRole, { href: string; title: string; description: string; tag?: string }[]> = {
  admin: [
    { href: "/departments", title: "Structure & departments", description: "Validate departments, batches, and subject ladders before scaling data entry.", tag: "Academic" },
    { href: "/admin/users", title: "People & access", description: "Provision faculty and student accounts with the right institutional roles.", tag: "Admin" },
    { href: "/timetable", title: "Timetable density", description: "See how weekly slots distribute across departments and teaching load.", tag: "Ops" },
  ],
  teacher: [
    { href: "/attendance", title: "Mark attendance", description: "Open the operational surface for today’s rostered subject runs.", tag: "Today" },
    { href: "/students", title: "Student directory", description: "Review learners tied to your department and batch intersections.", tag: "Roster" },
    { href: "/timetable", title: "Weekly plan", description: "Scan the canonical schedule powering your class expectations.", tag: "Plan" },
  ],
  student: [
    { href: "/subjects", title: "My subjects", description: "See each subject, who teaches it, the syllabus, and your datewise attendance.", tag: "Academics" },
    { href: "/results", title: "My results", description: "Assessment marks and grades per subject, grouped by semester.", tag: "Grades" },
    { href: "/attendance", title: "Attendance", description: "Full attendance history with subject breakdown and at-risk flags.", tag: "Insights" },
  ],
};

type DashboardHomeProps = {
  user: User | null;
  overview: AcademicOverview | null;
  timetable: TimetableEntry[];
  holidays: Holiday[];
  subjectAttendance: SubjectAttendanceSnapshot[];
  recentAttendance?: AttendanceRecord[];
  loading: boolean;
  error: string;
};

const attendanceBandClasses = (percentage: number) => {
  if (percentage < 75) {
    return {
      card: "border-rose-200 bg-rose-50/70",
      bar: "bg-rose-500",
      text: "text-rose-700",
    };
  }
  if (percentage < 85) {
    return {
      card: "border-amber-200 bg-amber-50/70",
      bar: "bg-amber-500",
      text: "text-amber-700",
    };
  }
  return {
    card: "border-emerald-200 bg-emerald-50/70",
    bar: "bg-emerald-500",
    text: "text-emerald-700",
  };
};

export const DashboardHome = ({ user, overview, timetable, holidays, subjectAttendance, recentAttendance = [], loading, error }: DashboardHomeProps) => {
  const role = (user?.role || "student") as UserRole;
  const intro = roleIntro[role];
  const actions = roleActions[role];

  const todayName = useMemo(
    () => new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date()).toLowerCase() as (typeof WEEK_DAYS)[number],
    [],
  );

  const todaysSchedule = useMemo(() => timetable.filter((entry) => entry.day === todayName), [timetable, todayName]);

  const weekStripData = useMemo(
    () =>
      WEEK_DAYS.map((day) => ({
        day,
        short: day.slice(0, 3),
        count: timetable.filter((e) => e.day === day).length,
      })),
    [timetable],
  );

  const personal = overview?.personal;
  const metrics = overview?.metrics;

  const departmentBars = useMemo(() => {
    const rows = (overview?.departments || [])
      .map((d) => ({ id: d.id, label: d.name, value: d.student_count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    const max = Math.max(1, ...rows.map((r) => r.value));
    return { rows, max };
  }, [overview?.departments]);

  const facultyBars = useMemo(() => {
    const rows = (overview?.departments || [])
      .map((d) => ({ id: d.id, label: d.name, value: d.faculty_count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    const max = Math.max(1, ...rows.map((r) => r.value));
    return { rows, max };
  }, [overview?.departments]);

  const pipelineNodes = useMemo(() => {
    if (!metrics) {
      return [];
    }
    return [
      { name: "Departments", count: metrics.department_count },
      { name: "Faculty", count: metrics.faculty_count },
      { name: "Students", count: metrics.student_count },
      { name: "Subjects", count: metrics.subject_count },
      { name: "Timetable", count: metrics.timetable_slot_count },
    ];
  }, [metrics]);

  const attPctKnown = personal?.overall_attendance_percentage != null;
  const attPct = personal?.overall_attendance_percentage ?? 0;

  if (loading && !overview) {
    return (
      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-28" />
          ))}
        </div>
        <SkeletonBlock className="h-48" />
        <div className="grid gap-6 lg:grid-cols-2">
          <SkeletonBlock className="h-80" />
          <SkeletonBlock className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageIntro eyebrow={intro.eyebrow} title={intro.title} description={intro.summary} />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <section className="hero-panel relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 mesh-noise opacity-50" />
        <div className="relative grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100">Live workspace</p>
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-[2rem] leading-tight">
              {role === "admin"
                ? "Balance institutional coverage against operational tempo."
                : role === "teacher"
                  ? "Teach from a timetable-backed cockpit—not scattered spreadsheets."
                  : "Stay oriented with attendance truth and what’s next on your calendar."}
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-slate-200">
              Data below refreshes from the same APIs powering attendance, timetable, and roster screens—so this page is never just decorative chrome.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/chat"
                className="inline-flex items-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-lg shadow-slate-900/20 transition hover:bg-cyan-50"
              >
                Open AI assistant
              </Link>
              {actions[0] ? (
                <Link
                  href={actions[0].href}
                  className="inline-flex items-center rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  {actions[0].title}
                </Link>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-xs font-medium text-slate-300">Today&apos;s sessions</p>
              <p className="mt-2 text-4xl font-semibold tabular-nums text-white">
                {loading ? "…" : personal?.today_class_count ?? todaysSchedule.length}
              </p>
              <p className="mt-2 text-xs text-slate-300">Pulled from rostered timetable slots for {formatLabel(todayName)}.</p>
            </div>
            <div className="rounded-[24px] border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-xs font-medium text-slate-300">Visible modules</p>
              <p className="mt-2 text-4xl font-semibold tabular-nums text-white">{loading ? "…" : overview?.modules.length ?? 0}</p>
              <p className="mt-2 text-xs text-slate-300">Mapped to your effective permissions for this login.</p>
            </div>
            {role === "student" ? (
              <div className="sm:col-span-2 rounded-[24px] border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
                <p className="text-xs font-medium text-slate-300">Workspace</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {[personal?.department, personal?.batch_year ? `Batch ${personal.batch_year}` : null, personal?.semester ? `Sem ${personal.semester}` : null]
                    .filter(Boolean)
                    .join(" · ") || "Your academic context loads with your profile."}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {role === "admin" && metrics ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            label="Departments"
            value={metrics.department_count}
            sub="Structural roots for batches & subjects"
            accent="cyan"
            href="/departments"
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M3 21h18v-2H3v2Zm2-4h3V7H5v10Zm5 0h4V3h-4v14Zm6 0h3v-8h-3v8Z" />
              </svg>
            }
          />
          <KpiTile
            label="Students"
            value={metrics.student_count}
            sub="Active directory size"
            accent="emerald"
            href="/students"
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3ZM8 11c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Z" />
              </svg>
            }
          />
          <KpiTile
            label="Faculty"
            value={metrics.faculty_count}
            sub="Teaching staff records"
            accent="violet"
            href="/faculty"
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M12 12c2.76 0 5-2.24 5-5S14.76 2 12 2 7 4.24 7 7s2.24 5 5 5Z" />
              </svg>
            }
          />
          <KpiTile
            label="Timetable slots"
            value={metrics.timetable_slot_count}
            sub={`${metrics.attendance_record_count} attendance marks · ${metrics.result_record_count} results`}
            accent="amber"
            href="/timetable"
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z" />
              </svg>
            }
          />
        </section>
      ) : null}

      {role === "teacher" && personal ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            label="Rostered slots"
            value={personal.timetable_slot_count}
            sub="Across your assigned teaching plan"
            accent="cyan"
            href="/timetable"
            icon={<IconCalendar />}
          />
          <KpiTile
            label="Today"
            value={personal.today_class_count}
            sub="Sessions scheduled for this calendar day"
            accent="amber"
            href="/attendance"
            icon={<IconClock />}
          />
          <KpiTile
            label="Subjects"
            value={personal.assigned_subject_count}
            sub="Distinct subject ownership"
            accent="violet"
            href="/timetable"
            icon={<IconBook />}
          />
          <KpiTile
            label="Attendance marks"
            value={personal.attendance_record_count}
            sub="Historical presence events you've contributed to"
            accent="emerald"
            href="/attendance"
            icon={<IconCheck />}
          />
        </section>
      ) : null}

      {role === "student" && personal ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            label="Timetable slots"
            value={personal.timetable_slot_count}
            sub="Mapped to your cohort this term"
            accent="cyan"
            href="/timetable"
            icon={<IconCalendar />}
          />
          <KpiTile
            label="Today"
            value={personal.today_class_count}
            sub="Classes on your calendar for today"
            accent="amber"
            href="/timetable"
            icon={<IconSun />}
          />
          <KpiTile
            label="Subjects"
            value={personal.assigned_subject_count}
            sub="Active subject enrollments this semester"
            accent="violet"
            href="/subjects"
            icon={<IconBook />}
          />
          <KpiTile
            label="Results logged"
            value={personal.result_record_count}
            sub="Assessment entries on file"
            accent="slate"
            href="/results"
            icon={<IconChart />}
          />
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <SectionCard
          title="Rhythm of the week"
          description="How timetable slots distribute—useful for spotting overload days before they hit the classroom."
          className="!p-0 overflow-hidden"
        >
          <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-5">
            <WeekStrip counts={weekStripData} />
          </div>
          <div className="space-y-4 px-6 py-6">
            <p className="text-sm font-medium text-slate-700">Today — {formatLabel(todayName)}</p>
            {loading ? <p className="text-sm text-slate-500">Loading today’s roster…</p> : null}
            {!loading && todaysSchedule.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No timetable entries today. Check the full timetable for other weekdays.
              </p>
            ) : null}
            <div className="space-y-3">
              {todaysSchedule.map((entry) => (
                <ScheduleBlock
                  key={entry.id}
                  subject={entry.subject_name}
                  time={`${formatTime(entry.start_time)} – ${formatTime(entry.end_time)}`}
                  meta={`${entry.department} · Batch ${entry.batch_year} · Sem ${entry.semester}`}
                  foot={entry.room ? `Room ${entry.room}` : undefined}
                />
              ))}
            </div>
          </div>
        </SectionCard>

        <div className="space-y-6">
          {role === "student" ? (
            <SectionCard title="Attendance focus" description="A single focal read on your cumulative presence.">
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
                {attPctKnown ? (
                  <AttendanceRing percentage={attPct} />
                ) : (
                  <div className="grid h-36 w-full max-w-[220px] place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
                    Attendance percentage appears after your instructors record marks.
                  </div>
                )}
                <div className="max-w-xs space-y-3 text-sm text-slate-600">
                  <p>
                    Percentage aggregates your own history—other students remain private under the same permission model powering the attendance
                    screens.
                  </p>
                  <Link href="/attendance" className="inline-flex font-semibold text-cyan-800 hover:underline">
                    Open full attendance view
                  </Link>
                </div>
              </div>
              
              {recentAttendance.length > 0 && (
                <div className="mt-8">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Recently marked classes</p>
                  <div className="space-y-2">
                    {recentAttendance.map((rec) => (
                      <div key={rec.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white/50 px-4 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800">{subjectAttendance.find(s => s.subjectId === rec.subject_id)?.name || "Class"}</p>
                          <p className="text-xs text-slate-500">{new Date(rec.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-tight ${
                          rec.status === 'present' ? 'bg-emerald-50 text-emerald-700' : 
                          rec.status === 'late' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {rec.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          ) : null}

          {role === "student" ? (
            <SectionCard title="Subject attendance" description="Red below 75%, yellow below 85%, green from 85% to 100%.">
              {subjectAttendance.length === 0 ? (
                <p className="text-sm text-slate-500">Subject-wise attendance appears after your instructors record marks.</p>
              ) : (
                <div className="space-y-3">
                  {subjectAttendance.slice(0, 6).map((subject) => {
                    const band = attendanceBandClasses(subject.percentage);
                    return (
                      <Link
                        key={subject.subjectId}
                        href={`/attendance?subject_id=${subject.subjectId}`}
                        className={`block rounded-2xl border px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-md ${band.card}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{subject.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {subject.semester ? `Sem ${subject.semester} | ` : ""}
                              {subject.attended}/{subject.total} attended
                            </p>
                          </div>
                          <span className={`shrink-0 text-sm font-bold tabular-nums ${band.text}`}>{subject.percentage}%</span>
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/80">
                          <div className={`h-full rounded-full ${band.bar}`} style={{ width: `${subject.percentage}%` }} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          ) : null}

          <SectionCard title="Calendar anchor" description="Next institution holiday from the shared academic calendar.">
            {loading ? <p className="text-sm text-slate-500">Loading holidays…</p> : null}
            {!loading && holidays[0] ? (
              <div className="rounded-2xl border border-cyan-200/60 bg-gradient-to-br from-cyan-50 to-white p-5">
                <p className="text-lg font-semibold text-slate-900">{holidays[0].description}</p>
                <p className="mt-2 text-sm text-cyan-900/80">{formatDate(holidays[0].date)}</p>
                <Link href="/timetable" className="mt-4 inline-block text-sm font-semibold text-cyan-800 hover:underline">
                  View timetable context
                </Link>
              </div>
            ) : null}
            {!loading && !holidays[0] ? (
              <p className="text-sm text-slate-500">No holidays published—add them from the timetable tools when you’re ready.</p>
            ) : null}
          </SectionCard>
        </div>
      </section>

      {role === "admin" && metrics && departmentBars.rows.length > 0 ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <SectionCard title="Students by department" description="Where enrollment weight sits—helps you catch imbalance early.">
            <BarDistribution title="" rows={departmentBars.rows} max={departmentBars.max} valueKey="stu" />
          </SectionCard>
          <SectionCard title="Faculty by department" description="Teaching footprint across the academic graph.">
            <BarDistribution title="" rows={facultyBars.rows} max={facultyBars.max} valueKey="fac" />
          </SectionCard>
        </section>
      ) : null}

      {role === "admin" && pipelineNodes.length > 0 ? (
        <SectionCard title="Operational pipeline" description="Entity counts chained in the order data typically flows through StudentMS.">
          <FlowPipeline nodes={pipelineNodes} />
        </SectionCard>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Shortcut deck" description="High-intent navigation tuned for your current role.">
          <div className="grid gap-4 sm:grid-cols-3">
            {actions.map((a) => (
              <ActionTile key={a.href} href={a.href} title={a.title} description={a.description} tag={a.tag} />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Access you carry" description="Modules exposed for this login—mirrors backend authorization.">
          <div className="grid gap-3">
            {(overview?.modules || []).slice(0, 6).map((module) => (
              <div
                key={module.key}
                className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/90 bg-gradient-to-r from-white to-slate-50/90 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{module.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{module.description}</p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  {module.access_roles.map((r) => r[0]).join("")}
                </span>
              </div>
            ))}
            {(overview?.modules.length || 0) === 0 && !loading ? (
              <p className="text-sm text-slate-500">No module metadata returned—check overview permissions.</p>
            ) : null}
          </div>
        </SectionCard>
      </section>

      {role === "admin" ? (
        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <SectionCard title="Department ledger" description="Cross-dimensional counts for each academic unit (top eight by student volume).">
            <div className="overflow-hidden rounded-2xl border border-slate-200/90">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3 text-right">Students</th>
                    <th className="px-4 py-3 text-right">Faculty</th>
                    <th className="px-4 py-3 text-right hidden sm:table-cell">Subjects</th>
                    <th className="px-4 py-3 text-right hidden md:table-cell">Slots</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        Loading ledger…
                      </td>
                    </tr>
                  ) : null}
                  {!loading && (overview?.departments.length || 0) === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No departments yet—seed structure to unlock analytics.
                      </td>
                    </tr>
                  ) : null}
                  {(overview?.departments || [])
                    .slice()
                    .sort((a, b) => b.student_count - a.student_count)
                    .slice(0, 8)
                    .map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <Link href={`/students?department=${encodeURIComponent(d.name)}`} className="hover:text-cyan-700 hover:underline">
                            {d.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">{d.student_count}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">{d.faculty_count}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600 hidden sm:table-cell">{d.subject_count}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600 hidden md:table-cell">{d.timetable_slot_count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Dependency graph" description="What feeds what—mirrors backend overview nodes.">
            <div className="space-y-3 max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
              {(overview?.dependency_flow || []).map((node) => (
                <div key={node.entity} className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{node.entity}</p>
                    <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-bold text-cyan-900">{node.live_records} rows</span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-600">↑</span> {node.upstream.join(", ") || "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-600">↓</span> {node.downstream.join(", ") || "—"}
                  </p>
                </div>
              ))}
              {(overview?.dependency_flow || []).length === 0 && !loading ? (
                <p className="text-sm text-slate-500">No dependency metadata available.</p>
              ) : null}
            </div>
          </SectionCard>
        </section>
      ) : null}
    </div>
  );
};

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 14H5V9h14v9Z" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2Zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3Z" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M18 2H9a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h9c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2Zm0 16H9V4h9v14ZM3 4v16h2V4H3Z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM2 13h2v-2H2v2Zm18 0h2v-2h-2v2ZM11 2v2h2V2h-2Zm0 18v2h2v-2h-2ZM4.93 4.93l1.41 1.41 1.41-1.41-1.41-1.41-1.41 1.41Zm12.73 12.73 1.41 1.41 1.41-1.41-1.41-1.41-1.41 1.41Zm1.41-14.14-1.41 1.41 1.41 1.41 1.41-1.41-1.41-1.41ZM4.93 19.07l1.41-1.41-1.41-1.41-1.41 1.41 1.41 1.41Z" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2ZM9 17H7v-7h2v7Zm4 0h-2V7h2v10Zm4 0h-2v-4h2v4Z" />
    </svg>
  );
}
