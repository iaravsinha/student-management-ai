import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

export const SkeletonBlock = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "animate-pulse rounded-2xl bg-gradient-to-r from-slate-200/80 via-slate-100 to-slate-200/80 bg-[length:200%_100%]",
      className,
    )}
  />
);

export const KpiTile = ({
  label,
  value,
  sub,
  icon,
  accent = "cyan",
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  accent?: "cyan" | "amber" | "violet" | "emerald" | "slate";
  href?: string;
}) => {
  const ring = {
    cyan: "from-cyan-500/20 to-teal-500/10",
    amber: "from-amber-500/20 to-orange-500/10",
    violet: "from-violet-500/20 to-indigo-500/10",
    emerald: "from-emerald-500/20 to-teal-500/10",
    slate: "from-slate-400/15 to-slate-300/10",
  }[accent];

  const inner = (
    <>
      <div className={cn("pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-gradient-to-br blur-2xl", ring)} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-950">{value}</p>
          {sub ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{sub}</p> : null}
        </div>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200/80 bg-slate-50 text-slate-700 shadow-sm">{icon}</div>
      </div>
      {href ? (
        <p className="relative mt-3 text-[11px] font-semibold text-cyan-700 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          Open →
        </p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="group app-surface relative overflow-hidden p-5 transition hover:border-cyan-300/50 hover:shadow-md">
        {inner}
      </Link>
    );
  }

  return (
    <div className="app-surface relative overflow-hidden p-5">
      {inner}
    </div>
  );
};

export const BarDistribution = ({
  title,
  description,
  rows,
  max,
  valueKey,
}: {
  title?: string;
  description?: string;
  rows: { id: number | string; label: string; value: number }[];
  max: number;
  valueKey: string;
}) => (
  <div className="space-y-4">
    {title || description ? (
      <div>
        {title ? <h3 className="text-base font-semibold text-slate-950">{title}</h3> : null}
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
    ) : null}
    <div className="space-y-3">
      {rows.map((row, i) => {
        const pct = max > 0 ? Math.min(100, Math.round((row.value / max) * 100)) : 0;
        return (
          <div key={`${valueKey}-${row.id}`}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-slate-700">{row.label}</span>
              <span className="shrink-0 tabular-nums text-slate-500">{row.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-600 via-teal-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${pct}%`, transitionDelay: `${i * 40}ms` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export const WeekStrip = ({
  counts,
}: {
  counts: { day: string; count: number; short: string }[];
}) => {
  const max = Math.max(1, ...counts.map((c) => c.count));
  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      {counts.map(({ day, count, short }) => {
        const h = Math.max(12, Math.round((count / max) * 56));
        return (
          <div key={day} className="flex flex-1 flex-col items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/90 px-2 py-3 sm:min-w-[52px]">
            <div className="flex h-14 w-full items-end justify-center rounded-lg bg-slate-100 px-1">
              <div
                className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-cyan-700 to-cyan-400 transition-all duration-500"
                style={{ height: `${h}px` }}
                title={`${day}: ${count} slots`}
              />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{short}</span>
          </div>
        );
      })}
    </div>
  );
};

export const AttendanceRing = ({ percentage }: { percentage: number }) => {
  const p = Math.min(100, Math.max(0, Math.round(percentage)));
  const deg = (p / 100) * 360;
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div
        className="relative grid h-36 w-36 place-items-center rounded-full shadow-inner shadow-slate-200/80"
        style={{
          background: `conic-gradient(rgb(8 145 178) ${deg}deg, rgb(241 245 249) 0deg)`,
        }}
      >
        <div className="grid h-[5.25rem] w-[5.25rem] place-items-center rounded-full bg-white shadow-sm">
          <div className="text-center">
            <p className="text-3xl font-semibold tabular-nums text-slate-950">{p}%</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Attendance</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ScheduleBlock = ({
  subject,
  meta,
  time,
  foot,
}: {
  subject: string;
  meta: string;
  time: string;
  foot?: string;
}) => (
  <div className="group flex gap-4 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 p-4 shadow-sm transition hover:border-cyan-300/50 hover:shadow-md">
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-lg font-bold text-white shadow-md">
      {subject.trim().charAt(0).toUpperCase() || "—"}
    </div>
    <div className="min-w-0 flex-1">
      <p className="font-semibold text-slate-900">{subject}</p>
      <p className="mt-0.5 text-sm text-cyan-800/90">{time}</p>
      <p className="mt-1 text-xs text-slate-500">{meta}</p>
      {foot ? <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">{foot}</p> : null}
    </div>
  </div>
);

export const ActionTile = ({
  href,
  title,
  description,
  tag,
}: {
  href: string;
  title: string;
  description: string;
  tag?: string;
}) => (
  <Link
    href={href}
    className="group relative overflow-hidden rounded-[22px] border border-slate-200/90 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/60 hover:shadow-lg"
  >
    {tag ? (
      <span className="mb-2 inline-block rounded-full bg-cyan-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-800">
        {tag}
      </span>
    ) : null}
    <p className="text-base font-semibold text-slate-950">{title}</p>
    <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
    <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-cyan-800 group-hover:gap-2">
      Open
      <span aria-hidden>→</span>
    </span>
  </Link>
);

export const FlowPipeline = ({ nodes }: { nodes: { name: string; count: number }[] }) => (
  <div className="flex flex-wrap items-center gap-2">
    {nodes.map((node, i) => (
      <div key={node.name} className="flex flex-wrap items-center gap-2">
        {i > 0 ? (
          <span className="hidden text-slate-300 sm:inline" aria-hidden>
            →
          </span>
        ) : null}
        <div className="rounded-2xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500">{node.name}</p>
          <p className="text-sm font-bold tabular-nums text-slate-900">{node.count}</p>
        </div>
      </div>
    ))}
  </div>
);
