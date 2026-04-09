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
        <title>Login | StudentMS</title>
      </Head>

      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[32px] border border-white/70 bg-white/85 shadow-xl shadow-slate-200/70 backdrop-blur lg:grid-cols-[1.1fr_0.9fr]">
          <section className="hero-panel hidden rounded-none border-0 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10">
                <span className="text-xl font-semibold">SM</span>
              </div>
              <p className="mt-8 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200">
                Academic workspace
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight">
                Keep student operations organized, modern, and easy to act on.
              </h1>
              <p className="mt-5 max-w-md text-sm leading-7 text-slate-200">
                Access student records, attendance workflows, timetable planning, and the built-in
                AI assistant from one focused role-aware interface.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
                <p className="text-sm text-slate-300">Designed for</p>
                <p className="mt-2 text-xl font-semibold">Admins, teachers, and students</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
                <p className="text-sm text-slate-300">Built-in capabilities</p>
                <p className="mt-2 text-xl font-semibold">Student data, attendance, timetable, AI</p>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center p-6 sm:p-10">
            <div className="w-full max-w-md space-y-8">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600">Welcome back</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Sign in to StudentMS</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Use the credentials provisioned by your administrator to access your workspace.
                </p>
              </div>

              <form className="space-y-5" onSubmit={onSubmit}>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Email</span>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Password</span>
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>

                {error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Signing in..." : "Login"}
                </button>
              </form>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Accounts are created by administrators. If you don&apos;t have access yet, review{" "}
                <Link href="/signup" className="font-semibold text-brand-700 hover:text-brand-800">
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
