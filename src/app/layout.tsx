import type { Metadata } from "next";
import Link from "next/link";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-800 antialiased">
        <header className="border-b border-slate-200 bg-white print:hidden">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
            <Link href="/" className="mr-2 text-base font-bold text-brand-700">
              ⚾ Practice Planner
            </Link>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-sm font-medium text-slate-600 hover:text-brand-700">
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 print:max-w-none print:p-0">{children}</main>
      </body>
    </html>
  );
}
