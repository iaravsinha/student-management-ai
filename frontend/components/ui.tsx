import { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/utils";

export const PageIntro = ({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) => (
  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
    <div className="space-y-3">
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-700">{eyebrow}</p>
      ) : null}
      <div className="space-y-3">
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2.35rem] sm:leading-tight">
          {title}
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-[15px]">{description}</p>
      </div>
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-3 lg:justify-end">{actions}</div> : null}
  </div>
);

export const StatCard = ({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "brand" | "success" | "warning";
}) => {
  const toneClasses = {
    default: "from-white via-slate-50/40 to-white",
    brand: "from-cyan-50/90 via-white to-white",
    success: "from-emerald-50/90 via-white to-white",
    warning: "from-amber-50/90 via-white to-white",
  };

  const accents = {
    default: "bg-slate-400",
    brand: "bg-cyan-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
  };

  return (
    <article className={cn("metric-card relative overflow-hidden bg-gradient-to-br transition hover:shadow-md", toneClasses[tone])}>
      <span className={cn("absolute left-0 top-0 h-full w-[3px]", accents[tone])} aria-hidden />
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 tabular-nums">{value}</p>
      {hint ? <p className="mt-2 text-sm leading-6 text-slate-500">{hint}</p> : null}
    </article>
  );
};

export const SectionCard = ({
  title,
  description,
  children,
  actions,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) => (
  <section className={cn("app-surface relative overflow-hidden p-6 sm:p-7", className)}>
    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
    <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">{title}</h2>
        {description ? <p className="max-w-3xl text-sm leading-relaxed text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
    {children}
  </section>
);

export const EmptyState = ({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) => (
  <div className="rounded-[28px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,0.92))] px-6 py-10 text-center">
    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
    <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-500">{description}</p>
    {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
  </div>
);

export const Badge = ({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "success" | "danger" | "brand" | "warning";
  children: ReactNode;
  className?: string;
}) => {
  const tones = {
    neutral: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
    success: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
    danger: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
    brand: "bg-brand-100 text-brand-800 ring-1 ring-brand-200",
    warning: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  };

  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
};

export const ActionButton = ({
  children,
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) => {
  const variants = {
    primary:
      "bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-lg shadow-slate-900/20 ring-1 ring-white/10 hover:from-slate-800 hover:to-slate-900",
    secondary:
      "border border-slate-200/90 bg-white text-slate-700 shadow-sm hover:border-cyan-300/50 hover:bg-cyan-50/50 hover:text-slate-900",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-gradient-to-br from-rose-600 to-rose-700 text-white shadow-lg shadow-rose-600/25 hover:from-rose-500 hover:to-rose-600",
  };

  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
};

export const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) => (
  <label className="block space-y-2">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    {children}
    {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
  </label>
);

export const Notice = ({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "danger";
  children: ReactNode;
}) => {
  const tones = {
    info: "border-brand-200 bg-brand-50 text-brand-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    danger: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return <div className={cn("rounded-2xl border px-4 py-3 text-sm", tones[tone])}>{children}</div>;
};

export const AccessDenied = ({ message }: { message: string }) => (
  <SectionCard title="Access restricted" description={message}>
    <EmptyState
      title="This area is only available to authorized roles"
      description="Your account can still use the rest of the platform through the navigation available to you."
    />
  </SectionCard>
);
