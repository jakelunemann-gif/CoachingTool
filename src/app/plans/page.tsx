import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDateLong, formatTimeRange } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const user = await requireUser();
  const plans = await prisma.plan.findMany({
    where: { userId: user.id },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { team: { select: { name: true } } },
  });
  const byTeam = new Map<string, typeof plans>();
  for (const p of plans) {
    const key = p.team?.name ?? "No team";
    byTeam.set(key, [...(byTeam.get(key) ?? []), p]);
  }
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="h1">Practice plans</h1>
        <Link href="/plans/new" className="btn btn-primary">New plan</Link>
      </div>
      {plans.length === 0 && <p className="text-slate-600">No plans yet. Build your first one.</p>}
      {[...byTeam.entries()].map(([team, list]) => (
        <section key={team} className="card">
          <h2 className="h2 mb-2">{team}</h2>
          <ul className="divide-y">
            {list.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <Link href={`/plans/${p.id}`} className="font-medium text-brand-700 hover:underline">{p.title}</Link>
                <span className="text-xs text-slate-500">
                  {formatDateLong(p.date)} · {formatTimeRange(p.startTime, p.durationMin)}{p.location && ` · ${p.location}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
