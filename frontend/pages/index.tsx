import Head from "next/head";
import Link from "next/link";

import { useAuth } from "../context/AuthContext";

const featureCards = [
  {
    title: "Role-aware journeys",
    description: "Admins orchestrate structure while teachers and students land on task-ready surfaces without noisy clutter.",
    accent: "from-cyan-500 to-teal-600",
  },
  {
    title: "Operations that stay linked",
    description: "Students, attendance, timetable, and holidays share one graph—updates ripple predictably across screens.",
    accent: "from-amber-500 to-orange-600",
  },
  {
    title: "Assistant on tap",
    description: "Ask nuanced academic questions with grounded institutional context—right beside everyday workflows.",
    accent: "from-violet-500 to-indigo-600",
  },
];

const HomePage = () => {
  const { user } = useAuth();

  return (
    <>
      <Head>
        <title>StudentMS | Modern Student Management</title>
      </Head>
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1320px] flex-col gap-14 lg:gap-20">
          <header className="glass-header flex flex-wrap items-center justify-between gap-4 rounded-[28px] px-5 py-4 sm:px-8">
            <Link href="/" className="group flex items-center gap-3">
              <div className="relative grid h-12 w-12 shrink-0 place-items-center">
                <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-400/35 to-amber-300/25 opacity-70 blur-md transition group-hover:opacity-100" />
                <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-sm font-bold text-white shadow-lg">
                  SM
                </span>
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight text-slate-950">StudentMS</p>
                <p className="text-sm text-slate-500">Academic cloud cockpit</p>
              </div>
            </Link>
            <Link
              href={user ? "/dashboard" : "/login"}
              className="inline-flex items-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/25 ring-1 ring-white/10 transition hover:scale-[1.02]"
            >
              {user ? "Enter workspace" : "Login"}
            </Link>
          </header>

          <section className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/80 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-800 shadow-sm backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.85)]" />
                Academic rhythm
              </div>
              <div className="space-y-6">
                <h1 className="max-w-[18ch] text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-[3.35rem] lg:leading-[1.05]">
                  Campus workflows that feel{" "}
                  <span className="bg-gradient-to-r from-cyan-700 via-teal-700 to-slate-900 bg-clip-text text-transparent">lightweight</span>,{" "}
                  not improvised.
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-slate-600">
                  Records, attendance, calendars, and a conversational assistant coexist in one fluid workspace tuned for daily institutional cadence.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={user ? "/dashboard" : "/login"}
                  className="inline-flex items-center rounded-xl bg-gradient-to-br from-cyan-600 to-teal-700 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/20 ring-1 ring-white/15 transition hover:brightness-110"
                >
                  {user ? "Continue where you left off" : "Sign in to continue"}
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center rounded-xl border border-slate-200/90 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-cyan-300/50 hover:bg-cyan-50/40"
                >
                  How access works
                </Link>
              </div>
            </div>

            <div className="hero-panel relative p-6 sm:p-8">
              <div className="pointer-events-none absolute inset-0 mesh-noise opacity-70" />
              <div className="relative rounded-[26px] border border-white/15 bg-white/10 p-6 backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100">Pulse boards</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {[
                    ["Students", "Holistic roster"],
                    ["Attendance", "Live posture"],
                    ["Timetable", "Weekly signal"],
                    ["Assistant", "Context IQ"],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-2xl border border-white/12 bg-white/8 p-4 transition hover:bg-white/12">
                      <p className="text-xs font-medium text-slate-200">{k}</p>
                      <p className="mt-2 text-lg font-semibold text-white">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-5 pb-10 md:grid-cols-3">
            {featureCards.map((card) => (
              <article
                key={card.title}
                className="app-surface group relative overflow-hidden p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]"
              >
                <span
                  className={`pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${card.accent} opacity-[0.12] blur-2xl transition group-hover:opacity-[0.2]`}
                />
                <span className={`mb-4 inline-block h-1 w-12 rounded-full bg-gradient-to-r ${card.accent}`} />
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">{card.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{card.description}</p>
              </article>
            ))}
          </section>
        </div>
      </main>
    </>
  );
};

export default HomePage;
