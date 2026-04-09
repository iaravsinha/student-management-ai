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

      <main className="grid min-h-screen place-items-center px-4 py-8 sm:px-6">
        <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="hero-panel rounded-[32px] p-8 text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200">Access model</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight">Account creation is intentionally admin-managed.</h1>
            <p className="mt-5 text-sm leading-7 text-slate-300">
              Self-signup is disabled so roles, permissions, and institutional access stay controlled and
              accurate from the start.
            </p>
          </section>

          <section className="app-surface p-8 sm:p-10">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">How to get access</h2>
            <div className="mt-6 space-y-4">
              {steps.map((step, index) => (
                <div key={step} className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-sm font-semibold text-slate-900">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{step}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Go to login
              </Link>
              <Link
                href="/"
                className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
