import type { Metadata } from "next";
import Link from "next/link";
import { logOut } from "@/app/actions";
import { AccountMenu, DesktopNav, MobileTabBar } from "@/components/AppNav";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import "./globals.css";

export const metadata: Metadata = {
  title: "Practice Planner",
  description: "Build practice plans from your drill library.",
};

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
                <DesktopNav isAdmin={user.isAdmin} pending={pending} />
                <form action={logOut} className="ml-auto hidden items-center gap-2 text-sm text-slate-600 md:flex">
                  <span data-testid="signed-in-as">{user.name}</span>
                  <button className="text-brand-700 hover:underline">Log out</button>
                </form>
                <AccountMenu name={user.name} isAdmin={user.isAdmin} pending={pending} />
              </>
            )}
          </nav>
        </header>
        {user && <MobileTabBar />}
        <main className={`mx-auto max-w-6xl px-4 pt-6 md:pb-6 print:max-w-none print:p-0 ${user ? "pb-24" : "pb-6"}`}>{children}</main>
      </body>
    </html>
  );
}
