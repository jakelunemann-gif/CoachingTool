"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logOut } from "@/app/actions";
import { Menu, menuItemClass } from "./Menu";

const DESKTOP_LINKS = [
  { href: "/plans/new", label: "New Plan" },
  { href: "/plans", label: "Plans" },
  { href: "/drills", label: "Drill Library" },
  { href: "/teams", label: "Teams" },
  { href: "/settings", label: "Settings" },
];

/** "/plans/new" is its own tab, so it doesn't also light up "Plans". */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/plans") return pathname.startsWith("/plans") && !pathname.startsWith("/plans/new");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNav({ isAdmin, pending }: { isAdmin: boolean; pending: number }) {
  const pathname = usePathname();
  const adminActive = isActive(pathname, "/admin");
  const link = (active: boolean) => `text-sm font-medium hover:text-brand-700 ${active ? "text-brand-700" : "text-slate-600"}`;
  return (
    <div className="hidden items-center gap-x-5 md:flex">
      {DESKTOP_LINKS.map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <Link key={n.href} href={n.href} className={link(active)} aria-current={active ? "page" : undefined}>
            {n.label}
          </Link>
        );
      })}
      {isAdmin && (
        <Link href="/admin" className={link(adminActive)} aria-current={adminActive ? "page" : undefined}>
          Admin{pending > 0 && <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800" data-testid="review-count">{pending}</span>}
        </Link>
      )}
    </div>
  );
}

/** Settings, Admin and Log out live under the coach's name on phones, where the tab bar has no room for them. */
export function AccountMenu({ name, isAdmin, pending }: { name: string; isAdmin: boolean; pending: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  const item = `${menuItemClass} justify-between py-3`;
  return (
    <Menu
      className="ml-auto md:hidden"
      align="right"
      testId="account-menu"
      buttonClassName="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      label={
        <>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white" aria-hidden="true">{initials}</span>
          <span className="max-w-[9rem] truncate">{name}</span>
          {pending > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">{pending}</span>}
        </>
      }
    >
      <Link role="menuitem" href="/settings" className={item}>Settings</Link>
      {isAdmin && (
        <Link role="menuitem" href="/admin" className={item}>
          Admin review
          {pending > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">{pending} waiting</span>}
        </Link>
      )}
      <form action={logOut} className="border-t border-slate-100">
        <button role="menuitem" className={`${item} text-brand-700`}>Log out</button>
      </form>
    </Menu>
  );
}

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const TABS = [
  { href: "/", label: "Home", icon: icon("M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z") },
  { href: "/plans/new", label: "New plan", icon: icon("M12 8v8M8 12h8M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z") },
  { href: "/plans", label: "Plans", icon: icon("M9 4h6M9 4a1 1 0 0 0-1 1v1h8V5a1 1 0 0 0-1-1M8 6H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-2M9 12h6M9 16h4") },
  { href: "/drills", label: "Drills", icon: icon("M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM10 9v6l5-3z") },
  { href: "/teams", label: "Teams", icon: icon("M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-1a4 4 0 0 0-3-3.87M16 4.13a3.5 3.5 0 0 1 0 6.75") },
];

/** Bottom tab bar on phones, replacing the top links that wrapped onto three lines. */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden print:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? "text-brand-700" : "text-slate-500"}`}
            >
              {t.icon}
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
