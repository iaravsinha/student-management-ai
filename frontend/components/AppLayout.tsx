import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { UserRole } from "../lib/types";
import { cn, formatLabel } from "../lib/utils";
import { ActionButton, Badge } from "./ui";

type NavItem = {
  href: string;
  label: string;
  studentLabel?: string;
  roles: UserRole[];
  permission?: string;
  group: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "teacher", "student"], permission: "overview:read", group: "Overview" },
  { href: "/departments", label: "Departments", roles: ["admin", "teacher"], permission: "department:read", group: "Academic" },
  { href: "/students", label: "Students", studentLabel: "My profile", roles: ["admin", "teacher", "student"], permission: "student:read", group: "Academic" },
  { href: "/subjects", label: "Subjects", studentLabel: "My subjects", roles: ["admin", "teacher", "student"], permission: "subject:read", group: "Academic" },
  { href: "/results", label: "Results", studentLabel: "My results", roles: ["admin", "teacher", "student"], permission: "result:read", group: "Academic" },
  { href: "/faculty", label: "Faculty", roles: ["admin"], permission: "faculty:read", group: "People" },
  { href: "/timetable", label: "Timetable", roles: ["admin", "teacher", "student"], permission: "timetable:read", group: "Operations" },
  { href: "/attendance", label: "Attendance", roles: ["admin", "teacher", "student"], permission: "attendance:read", group: "Operations" },
  { href: "/chat", label: "AI Assistant", roles: ["admin", "teacher", "student"], group: "Assistant" },
  { href: "/admin/users", label: "Admin users", roles: ["admin"], permission: "auth:user:create", group: "Administration" },
];

const NavIcon = ({ href }: { href: string }) => {
  const icons: Record<string, ReactNode> = {
    "/dashboard": <path d="M4 12h6V4H4v8Zm0 8h6v-6H4v6Zm10 0h6V12h-6v8Zm0-16v6h6V4h-6Z" />,
    "/departments": <path d="M3 21h18v-2H3v2Zm2-4h3V7H5v10Zm5 0h4V3h-4v14Zm6 0h3v-8h-3v8Z" />,
    "/students": (
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3ZM8 11c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.98 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z" />
    ),
    "/faculty": (
      <path d="M12 12c2.76 0 5-2.24 5-5S14.76 2 12 2 7 4.24 7 7s2.24 5 5 5Zm-7 8v-1c0-2.67 5.33-4 8-4s8 1.33 8 4v1H5Zm13-8.75V8h-2V6h-2v2h-2v2h2v2h2v-2h2Z" />
    ),
    "/attendance": <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5c0-1.11-.89-2-2-2Zm0 16H5V8h14v11Zm-7-8h5v5h-5z" />,
    "/timetable": (
      <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 14H5V9h14v9Zm-8-7H7v4h4v-4Z" />
    ),
    "/chat": <path d="M4 4h16v12H5.17L4 17.17V4Zm2 2v6.34L6.83 12H18V6H6Zm2 2h8v2H8V8Z" />,
    "/subjects": <path d="M18 2H9a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h9c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2Zm0 16H9V4h9v14ZM3 4v16h2V4H3ZM11 7h5v2h-5zm0 4h5v2h-5zm0 4h3v2h-3z" />,
    "/results": <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2ZM9 17H7v-7h2v7Zm4 0h-2V7h2v10Zm4 0h-2v-4h2v4Z" />,
    "/admin/users": (
      <path d="M12 12c2.76 0 5-2.24 5-5S14.76 2 12 2 7 4.24 7 7s2.24 5 5 5Zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5Zm7-1V9h-2V7h-2v2h-2v2h2v2h2v-2h2Z" />
    ),
  };

  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-current opacity-90">
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
  const { user, logout, permissions } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const roleHeadline = {
    admin: "Institution control",
    teacher: "Teaching workspace",
    student: "Your academics",
  }[(user?.role || "student") as UserRole];

  const navItems = useMemo(
    () =>
      NAV_ITEMS.filter((item) => {
        const roleAllowed = item.roles.includes((user?.role || "student") as UserRole);
        const permissionAllowed = !item.permission || permissions.includes(item.permission);
        return roleAllowed && permissionAllowed;
      }),
    [permissions, user?.role],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, NavItem[]>();
    navItems.forEach((item) => {
      const list = map.get(item.group) || [];
      list.push(item);
      map.set(item.group, list);
    });
    return Array.from(map.entries());
  }, [navItems]);

  const handleLogout = () => {
    logout();
    void router.push("/login");
  };

  const pathActive = (href: string) => {
    if (href === "/departments") return router.pathname.startsWith("/departments");
    if (href === "/admin/users") return router.pathname.startsWith("/admin");
    return router.pathname === href;
  };

  const NavLink = ({ item, dense }: { item: NavItem; dense?: boolean }) => {
    const active = pathActive(item.href);
    const label = user?.role === "student" && item.studentLabel ? item.studentLabel : item.label;
    return (
      <Link
        href={item.href}
        onClick={() => setMobileMenuOpen(false)}
        className={cn(
          "group flex items-center gap-3 rounded-2xl font-medium transition-all duration-200",
          dense ? "px-3 py-2 text-[13px]" : "px-3.5 py-2.5 text-sm",
          active
            ? "nav-rail-active"
            : "text-slate-600 hover:bg-slate-100/90 hover:text-slate-900 hover:shadow-sm",
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
            active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-white group-hover:text-slate-900",
          )}
        >
          <NavIcon href={item.href} />
        </span>
        <span className="min-w-0 truncate">{label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1720px] gap-5 px-3 py-3 sm:px-5 md:py-5 lg:gap-8 lg:px-8">
        <aside className="hidden w-[272px] shrink-0 lg:block">
          <div className="app-surface sticky top-5 overflow-hidden">
            <div className="relative border-b border-slate-200/80 bg-gradient-to-br from-cyan-500/[0.08] via-white to-amber-400/[0.06] p-5">
              <div className="pointer-events-none absolute inset-0 mesh-noise opacity-40" />
              <Link href="/dashboard" className="relative inline-flex items-center gap-3 rounded-2xl p-1 transition hover:bg-white/40">
                <div className="relative grid h-11 w-11 shrink-0 place-items-center">
                  <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-400/35 to-amber-300/25 blur-md" />
                  <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-sm font-bold tracking-tight text-white shadow-lg shadow-slate-900/25">
                    SM
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold tracking-tight text-slate-950">StudentMS</p>
                  <p className="truncate text-xs font-medium text-slate-500">{roleHeadline}</p>
                </div>
              </Link>

              <div className="relative mt-5 rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Signed in</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900">{user?.email}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="brand">{formatLabel(user?.role || "user")}</Badge>
                  <Badge tone={user?.is_active ? "success" : "danger"}>{user?.is_active ? "Active" : "Inactive"}</Badge>
                </div>
              </div>
            </div>

            <nav className="scrollbar-thin max-h-[calc(100vh-14rem)] space-y-6 overflow-y-auto p-4">
              {grouped.map(([group, items]) => (
                <div key={group}>
                  <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{group}</p>
                  <div className="space-y-1">{items.map((item) => <NavLink key={item.href} item={item} />)}</div>
                </div>
              ))}
            </nav>

            <div className="border-t border-slate-200/80 p-4">
              <ActionButton variant="secondary" className="w-full justify-center rounded-xl shadow-sm" onClick={handleLogout}>
                Sign out
              </ActionButton>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1 pb-24 lg:pb-8">
          <header className="glass-header sticky top-3 z-30 mb-5 rounded-[26px] px-4 py-4 sm:px-6">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((c) => !c)}
                  className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
                  aria-expanded={mobileMenuOpen}
                  aria-label="Toggle navigation"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[2]">
                    {mobileMenuOpen ? (
                      <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                    ) : (
                      <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                    )}
                  </svg>
                </button>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700/90">Workspace</p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[1.65rem]">{title}</h1>
                  <p className="mt-1 text-sm text-slate-500">{roleHeadline}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:max-w-[min(100%,420px)] lg:justify-end">
                <Badge tone={user?.is_active ? "success" : "danger"} className="hidden sm:inline-flex">
                  {user?.is_active ? "Account active" : "Inactive"}
                </Badge>
                <Badge tone="neutral" className="hidden sm:inline-flex">
                  {formatLabel(user?.role || "user")}
                </Badge>
                <div className="hidden w-full flex-wrap justify-end gap-2 lg:flex lg:w-auto">{actions}</div>
              </div>
            </div>

            <div className="scrollbar-thin mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {navItems.map((item) => {
                const active = pathActive(item.href);
                const label = user?.role === "student" && item.studentLabel ? item.studentLabel : item.label;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "shrink-0 rounded-full border px-4 py-2 text-[13px] font-semibold transition-all duration-200",
                      active
                        ? "border-slate-900 bg-slate-900 text-white shadow-md shadow-slate-900/15"
                        : "border-slate-200/90 bg-white/90 text-slate-600 hover:border-cyan-300/60 hover:text-slate-900",
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>

            <nav className="mt-4 hidden flex-wrap gap-2 border-t border-slate-200/70 pt-4 lg:flex" aria-label="Workspace shortcuts">
              {navItems.map((item) => {
                const active = pathActive(item.href);
                const label = user?.role === "student" && item.studentLabel ? item.studentLabel : item.label;
                return (
                  <Link
                    key={`top-${item.href}`}
                    href={item.href}
                    className={cn(
                      "rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition",
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-transparent bg-slate-50/90 text-slate-600 hover:border-cyan-300/60 hover:bg-white hover:text-slate-900",
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>

            {mobileMenuOpen ? (
              <div className="mt-4 space-y-1 border-t border-slate-200/80 pt-4 animate-fade-up lg:hidden">
                {grouped.map(([group, items]) => (
                  <div key={group} className="space-y-1">
                    <p className="px-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group}</p>
                    {items.map((item) => (
                      <NavLink key={item.href} item={item} dense />
                    ))}
                  </div>
                ))}
                <ActionButton variant="secondary" className="mt-3 w-full justify-center rounded-xl" onClick={handleLogout}>
                  Sign out
                </ActionButton>
                {actions ? <div className="pt-3">{actions}</div> : null}
              </div>
            ) : null}
          </header>

          <main className="space-y-8">{children}</main>
        </div>
      </div>
    </div>
  );
};
