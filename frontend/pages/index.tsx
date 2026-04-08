import Head from "next/head";

const HomePage = () => {
  return (
    <>
      <Head>
        <title>Student Management with AI Assistant</title>
      </Head>
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            Student Management System
          </h1>
          <p className="text-slate-300 mb-6">
            Production-ready starter for a modern Student Management System with
            an integrated AI assistant, powered by FastAPI, PostgreSQL, Redis,
            and LangChain-ready RAG services.
          </p>
          <div className="inline-flex gap-3">
            <a
              href="/"
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
            >
              Dashboard (coming soon)
            </a>
            <a
              href="https://nextjs.org"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-900"
            >
              Learn more about the stack
            </a>
          </div>
        </div>
      </main>
    </>
  );
};

export default HomePage;

