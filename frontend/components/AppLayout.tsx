import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode, useMemo, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { UserRole } from "../lib/types";
import { cn, formatLabel } from "../lib/utils";
import { ActionButton, Badge } from "./ui";

type NavItem = {
  href: string;
  label: string;
  studentLabel?: string;
  roles: UserRole[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "teacher", "student"] },
  { href: "/departments", label: "Departments", roles: ["admin", "teacher"] },
  { href: "/students", label: "Students", studentLabel: "My Profile", roles: ["admin", "teacher", "student"] },
  { href: "/faculty", label: "Faculty", roles: ["admin"] },
  { href: "/attendance", label: "Attendance", roles: ["admin", "teacher", "student"] },
  { href: "/timetable", label: "Timetable", roles: ["admin", "teacher", "student"] },
  { href: "/chat", label: "AI Assistant", roles: ["admin", "teacher", "student"] },
  { href: "/admin/users", label: "Admin Users", roles: ["admin"] },
];

const NavIcon = ({ href }: { href: string }) => {
  const icons: Record<string, ReactNode> = {
    "/dashboard": <path d="M4 12h6V4H4v8Zm0 8h6v-6H4v6Zm10 0h6V12h-6v8Zm0-16v6h6V4h-6Z" />,
    "/students": <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3ZM8 11c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.98 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z" />,
    "/faculty": <path d="M12 12c2.76 0 5-2.24 5-5S14.76 2 12 2 7 4.24 7 7s2.24 5 5 5Zm-7 8v-1c0-2.67 5.33-4 8-4s8 1.33 8 4v1H5Zm13-8.75V8h-2V6h-2v2h-2v2h2v2h2v-2h2Z" />,
    "/attendance": <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5c0-1.11-.89-2-2-2Zm0 16H5V8h14v11Zm-7-8h5v5h-5z" />,
    "/timetable": <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 14H5V9h14v9Zm-8-7H7v4h4v-4Z" />,
    "/chat": <path d="M4 4h16v12H5.17L4 17.17V4Zm2 2v6.34L6.83 12H18V6H6Zm2 2h8v2H8V8Z" />,
    "/admin/users": <path d="M12 12c2.76 0 5-2.24 5-5S14.76 2 12 2 7 4.24 7 7s2.24 5 5 5Zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5Zm7-1V9h-2V7h-2v2h-2v2h2v2h2v-2h2Z" />,
  };

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      {icons[href]}
    </svg>
  );
};

export const AppLayout = ({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const roleHeadline = {
    admin: "Institution control center",
    teacher: "Teaching operations workspace",
    student: "Academic progress workspace",
  }[(user?.role || "student") as UserRole];

  const navItems = useMemo(
    () => NAV_ITEMS.filter((item) => item.roles.includes((user?.role || "student") as UserRole)),
    [user?.role],
  );

  const handleLogout = () => {
    logout();
    void router.push("/login");
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1680px] gap-6 px-4 py-4 md:px-6 lg:px-8">
        <aside className="hidden w-80 shrink-0 lg:block">
          <div className="sticky top-4 app-surface overflow-hidden">
            <div className="border-b border-slate-200 bg-[linear-gradient(155deg,rgba(9,99,125,0.14),rgba(255,255,255,0.35)_55%,rgba(240,180,41,0.08))] p-6">
              <Link href="/dashboard" className="inline-flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/20">
                  <span className="text-lg font-semibold">SM</span>
                </div>
                <div>
                  <p className="text-lg font-semibold tracking-tight text-slate-950">StudentMS</p>
                  <p className="text-sm text-slate-500">{roleHeadline}</p>
                </div>
              </Link>
              <div className="mt-6 rounded-[28px] border border-white/70 bg-white/85 p-4">
                <p className="text-sm font-medium text-slate-500">Signed in as</p>
                <p className="mt-1 truncate text-base font-semibold text-slate-900">{user?.email}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="brand">{formatLabel(user?.role || "user")}</Badge>
                  <Badge tone={user?.is_active ? "success" : "danger"}>
                    {user?.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </div>
            <nav className="space-y-1.5 p-4">
              {navItems.map((item) => {
                const active = router.pathname === item.href;
                const label = user?.role === "student" && item.studentLabel ? item.studentLabel : item.label;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-[22px] px-4 py-3 text-sm font-medium transition",
                      active
                        ? "bg-slate-950 text-white shadow-lg shadow-slate-900/10"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    <NavIcon href={item.href} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-slate-200 p-4">
              <ActionButton variant="secondary" className="w-full justify-center" onClick={handleLogout}>
                Logout
              </ActionButton>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="app-surface sticky top-4 z-20 mb-6 overflow-hidden px-4 py-4 sm:px-6">
            <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#0f172a,#0ea5a5,#f59e0b)]" />
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((current) => !current)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 lg:hidden"
                  aria-label="Toggle navigation"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2">
                    {mobileMenuOpen ? (
                      <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                    ) : (
                      <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                    )}
                  </svg>
                </button>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-700">Workspace</p>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
                  <p className="mt-1 text-sm text-slate-500">{roleHeadline}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={user?.is_active ? "success" : "danger"}>
                  {user?.is_active ? "Active account" : "Inactive account"}
                </Badge>
                <Badge>{formatLabel(user?.role || "user")}</Badge>
                <div className="hidden lg:flex">{actions}</div>
              </div>
            </div>

            {mobileMenuOpen ? (
              <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 lg:hidden">
                {navItems.map((item) => {
                  const active = router.pathname === item.href;
                  const label = user?.role === "student" && item.studentLabel ? item.studentLabel : item.label;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-[22px] px-4 py-3 text-sm font-medium transition",
                        active ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-700",
                      )}
                    >
                      <NavIcon href={item.href} />
                      <span>{label}</span>
                    </Link>
                  );
                })}
                <ActionButton variant="secondary" className="w-full justify-center" onClick={handleLogout}>
                  Logout
                </ActionButton>
                {actions ? <div className="pt-2">{actions}</div> : null}
              </div>
            ) : null}
          </header>

          <main className="space-y-6 pb-8">{children}</main>
        </div>
      </div>
    </div>
  );
};

