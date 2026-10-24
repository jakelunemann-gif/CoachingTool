import type { Metadata } from "next";
import Link from "next/link";
import { logOut } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import "./globals.css";

export const metadata: Metadata = {
  title: "Practice Planner",
  description: "Build practice plans from your drill library.",
};

const NAV = [
  { href: "/plans/new", label: "New Plan" },
  { href: "/plans", label: "Plans" },
  { href: "/drills", label: "Drill Library" },
  { href: "/teams", label: "Teams" },
  { href: "/settings", label: "Settings" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const pending = user?.isAdmin ? await prisma.drill.count({ where: { reviewStatus: "PENDING" } }) : 0;
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-800 antialiased">
        <header className="border-b border-slate-200 bg-white print:hidden">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
            <Link href="/" className="mr-2 text-base font-bold text-brand-700">
              ⚾ Practice Planner
            </Link>
            {user && (
              <>
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className="text-sm font-medium text-slate-600 hover:text-brand-700">
                    {n.label}
                  </Link>
                ))}
                {user.isAdmin && (
                  <Link href="/admin" className="text-sm font-medium text-slate-600 hover:text-brand-700">
                    Admin{pending > 0 && <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800" data-testid="review-count">{pending}</span>}
                  </Link>
                )}
                <form action={logOut} className="ml-auto flex items-center gap-2 text-sm text-slate-600">
                  <span data-testid="signed-in-as">{user.name}</span>
                  <button className="text-brand-700 hover:underline">Log out</button>
                </form>
              </>
            )}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 print:max-w-none print:p-0">{children}</main>
      </body>
    </html>
  );
}
