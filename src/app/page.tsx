import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDateLong } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [plans, drillCount, teamCount, planCount] = await Promise.all([
    prisma.plan.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 6, select: { id: true, title: true, date: true, location: true } }),
    prisma.drill.count(),
    prisma.team.count(),
    prisma.plan.count(),
  ]);
  return (
    <div className="space-y-6">
      <section className="card flex flex-col items-start gap-3 bg-gradient-to-br from-brand-50 to-white p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="h1">Plan your next practice</h1>
          <p className="mt-1 text-slate-600">
            Pick the date, field, team, coaches and what you want to work on. The planner builds a timed plan from your drill library, and you can edit it before printing or saving it to Google Drive.
          </p>
        </div>
        <Link href="/plans/new" className="btn btn-primary shrink-0 px-5 py-2 text-base">New practice plan</Link>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/drills" className="card hover:border-brand-500">
          <div className="text-3xl font-bold text-brand-700">{drillCount}</div>
          <div className="text-sm text-slate-600">drills in the library</div>
        </Link>
        <Link href="/teams" className="card hover:border-brand-500">
          <div className="text-3xl font-bold text-brand-700">{teamCount}</div>
          <div className="text-sm text-slate-600">{teamCount === 0 ? "teams. Add one to track attendance and rotate team leaders" : "teams"}</div>
        </Link>
        <Link href="/plans" className="card hover:border-brand-500">
          <div className="text-3xl font-bold text-brand-700">{planCount}</div>
          <div className="text-sm text-slate-600">saved plans</div>
        </Link>
      </div>
      {plans.length > 0 && (
        <section className="card">
          <h2 className="h2 mb-2">Recent plans</h2>
          <ul className="divide-y">
            {plans.map((p) => (
              <li key={p.id} className="py-2">
                <Link href={`/plans/${p.id}`} className="font-medium text-brand-700 hover:underline">{p.title}</Link>
                <div className="text-xs text-slate-500">{formatDateLong(p.date)}{p.location && ` · ${p.location}`}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
