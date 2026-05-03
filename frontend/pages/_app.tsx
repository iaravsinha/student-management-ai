import type { AppProps } from "next/app";
import { Plus_Jakarta_Sans } from "next/font/google";
import { useRouter } from "next/router";
import { useEffect } from "react";

import { GlobalAssistantWidget } from "../components/GlobalAssistantWidget";
import { AuthProvider, useAuth } from "../context/AuthContext";

import "../styles/globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

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
      <main className={`${sans.variable} grid min-h-screen place-items-center px-4 font-sans`}>
        <div className="app-surface relative max-w-md overflow-hidden p-8 text-center">
          <div className="pointer-events-none absolute inset-0 mesh-noise opacity-50" />
          <div className="relative">
            <div className="relative mx-auto mb-5 grid h-16 w-16 place-items-center">
              <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-400/30 to-amber-400/20 blur-xl" />
              <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-lg font-bold tracking-tight text-white shadow-xl shadow-slate-900/30">
                SM
              </div>
            </div>
            <div className="mx-auto mb-4 flex justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full bg-cyan-500/80 animate-typing-dot"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-950">Opening your workspace</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Syncing permissions and routing you to the right dashboard.
            </p>
          </div>
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
    <div className={`${sans.variable} font-sans antialiased`}>
      <AuthProvider>
        <AuthGate {...appProps} />
      </AuthProvider>
    </div>
  );
}

