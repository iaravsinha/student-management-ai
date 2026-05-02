import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect } from "react";

import { GlobalAssistantWidget } from "../components/GlobalAssistantWidget";
import { AuthProvider, useAuth } from "../context/AuthContext";

import "../styles/globals.css";

const PUBLIC_ROUTES = ["/login", "/signup", "/health", "/"];

const AuthGate = ({ Component, pageProps }: AppProps) => {
  const router = useRouter();
  const { user, loading } = useAuth();
  const isPublicRoute = PUBLIC_ROUTES.includes(router.pathname);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user && !isPublicRoute) {
      void router.replace("/login");
      return;
    }
    if (user && (router.pathname === "/login" || router.pathname === "/signup")) {
      void router.replace("/dashboard");
    }
  }, [user, loading, isPublicRoute, router]);

  if (!isPublicRoute && (loading || !user)) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
        <div className="app-surface max-w-md p-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-950 text-white">
            <span className="text-lg font-semibold">SM</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Checking your workspace</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            We&apos;re validating your session and loading the correct role-based dashboard.
          </p>
        </div>
      </main>
    );
  }
  return (
    <>
      <Component {...pageProps} />
      {!isPublicRoute && user ? <GlobalAssistantWidget /> : null}
    </>
  );
};

export default function App(appProps: AppProps) {
  return (
    <AuthProvider>
      <AuthGate {...appProps} />
    </AuthProvider>
  );
}

