import Head from "next/head";
import Link from "next/link";

const steps = [
  "An administrator creates your account with the correct role.",
  "You receive your initial credentials securely from the institution.",
  "You log in and are routed to the workspace for your role.",
];

const SignupPage = () => {
  return (
    <>
      <Head>
        <title>Account Provisioning | StudentMS</title>
      </Head>

      <main className="grid min-h-screen place-items-center px-4 py-8 sm:px-6 lg:py-12">
        <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-8">
          <section className="hero-panel relative overflow-hidden rounded-[32px] p-8 text-white">
            <div className="pointer-events-none absolute inset-0 mesh-noise opacity-60" />
            <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100">Access model</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight">Account creation is intentionally admin-managed.</h1>
            <p className="mt-5 text-sm leading-relaxed text-slate-300">
              Self-signup is disabled so roles, permissions, and institutional access stay controlled and
              accurate from the start.
            </p>
            </div>
          </section>

          <section className="app-surface p-8 sm:p-10">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">How to get access</h2>
            <div className="mt-6 space-y-4">
              {steps.map((step, index) => (
                <div key={step} className="flex gap-4 rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50/90 p-4 shadow-sm">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-sm font-bold text-white shadow-md">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">{step}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 ring-1 ring-white/10 transition hover:brightness-110"
              >
                Go to login
              </Link>
              <Link
                href="/"
                className="inline-flex items-center rounded-xl border border-slate-200/90 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-cyan-300/50 hover:bg-cyan-50/40"
              >
                Back to home
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export default SignupPage;
