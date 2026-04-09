import Head from "next/head";
import Link from "next/link";

import { useAuth } from "../context/AuthContext";

const featureCards = [
  {
    title: "Role-based workspace",
    description: "Give admins, teachers, and students a focused experience with the actions they actually need.",
  },
  {
    title: "Daily academic operations",
    description: "Manage students, attendance, timetable slots, holidays, and access control from one web app.",
  },
  {
    title: "Built-in AI assistant",
    description: "Ask contextual questions about student performance, weak subjects, and attendance signals.",
  },
];

const HomePage = () => {
  const { user } = useAuth();

  return (
    <>
      <Head>
        <title>StudentMS | Modern Student Management</title>
      </Head>
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col justify-between">
          <header className="flex items-center justify-between rounded-3xl border border-white/70 bg-white/80 px-6 py-4 shadow-sm shadow-slate-200/70 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white">
                <span className="text-lg font-semibold">SM</span>
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight text-slate-950">StudentMS</p>
                <p className="text-sm text-slate-500">Student management and AI assistance</p>
              </div>
            </div>
            <Link
              href={user ? "/dashboard" : "/login"}
              className="inline-flex items-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {user ? "Open workspace" : "Login"}
            </Link>
          </header>

          <section className="grid gap-10 py-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-8">
              <div className="space-y-5">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">
                  Clean academic operations
                </p>
                <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                  Student operations, timetable control, and role-based workflows in one polished workspace.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-slate-600">
                  StudentMS brings together academic records, attendance tracking, timetable planning,
                  and an AI assistant in one focused workspace designed for real institutional workflows.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={user ? "/dashboard" : "/login"}
                  className="inline-flex items-center rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  {user ? "Go to dashboard" : "Sign in to continue"}
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  How access works
                </Link>
              </div>
            </div>

            <div className="hero-panel overflow-hidden p-6 sm:p-8">
              <div className="rounded-[28px] border border-white/10 bg-white/10 p-6 text-white">
                <p className="text-sm text-slate-300">Today&apos;s workspace</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                    <p className="text-sm text-slate-300">Students</p>
                    <p className="mt-2 text-3xl font-semibold">Directory</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                    <p className="text-sm text-slate-300">Attendance</p>
                    <p className="mt-2 text-3xl font-semibold">Tracking</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                    <p className="text-sm text-slate-300">Timetable</p>
                    <p className="mt-2 text-3xl font-semibold">Weekly plan</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                    <p className="text-sm text-slate-300">AI Assistant</p>
                    <p className="mt-2 text-3xl font-semibold">Ask faster</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 pb-8 md:grid-cols-3">
            {featureCards.map((card) => (
              <article key={card.title} className="app-surface p-6">
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">{card.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
              </article>
            ))}
          </section>
        </div>
      </main>
    </>
  );
};

export default HomePage;
