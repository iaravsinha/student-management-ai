import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../lib/utils";

const LoginPage = () => {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      void router.push("/dashboard");
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Unexpected error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Login | EdXplore</title>
      </Head>

      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[32px] border border-white/80 bg-white/90 shadow-[0_40px_100px_-48px_rgba(15,23,42,0.55)] backdrop-blur-xl lg:grid-cols-[1.08fr_0.92fr]">
          <section className="hero-panel relative hidden flex-col justify-between p-10 lg:flex">
            <div className="pointer-events-none absolute inset-0 mesh-noise opacity-60" />
            <div className="relative">
              <div className="relative grid h-14 w-14 place-items-center">
                <span className="absolute inset-0 rounded-2xl bg-cyan-400/25 blur-xl" />
                <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-white/15 text-lg font-bold ring-2 ring-white/20">
                  SM
                </span>
              </div>
              <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100">Secure workspace</p>
              <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight leading-tight">
                Navigate academics with clarity—records, rhythm, and copilot in one lane.
              </h1>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-slate-200">
                EdXplore aligns admins, faculty, and students around shared operational truth rather than scattered spreadsheets.
              </p>
            </div>

            <div className="relative grid gap-4">
              <div className="rounded-[26px] border border-white/12 bg-white/10 p-5 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-wider text-slate-300">Made for distributed campuses</p>
                <p className="mt-2 text-lg font-semibold">Role fidelity · Audit-ready flows · Fast cues</p>
              </div>
              <div className="rounded-[26px] border border-white/12 bg-white/10 p-5 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-wider text-slate-300">Companion assistant</p>
                <p className="mt-2 text-lg font-semibold">Answers anchored on institutional records—not generic fluff.</p>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center p-6 sm:p-10">
            <div className="w-full max-w-md space-y-8">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700">Welcome back</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Sign in to EdXplore</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  Authenticate with the credentials provisioned by your institution administrator.
                </p>
              </div>

              <form className="space-y-5" onSubmit={onSubmit}>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">Email</span>
                  <input
                    type="email"
                    placeholder="you@campus.edu"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">Password</span>
                  <input
                    type="password"
                    placeholder="Enter password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>

                {error ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 ring-1 ring-white/10 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Signing you in…" : "Continue"}
                </button>
              </form>

              <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 px-4 py-4 text-sm leading-relaxed text-slate-600">
                Access stays administrator-managed by design—learn{" "}
                <Link href="/signup" className="font-semibold text-cyan-800 underline-offset-4 hover:underline">
                  how provisioning works
                </Link>
                .
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export default LoginPage;
