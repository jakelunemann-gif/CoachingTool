import { PlanForm } from "@/components/PlanForm";
import { requireUser } from "@/lib/auth/session";
import { getPlan, getSports, getTeams } from "@/lib/data";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewPlanPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const user = await requireUser();
  const [sports, teams, coaches, locations, source] = await Promise.all([
    getSports(user),
    getTeams(user.id),
    prisma.coach.findMany({ where: { userId: user.id, active: true }, orderBy: { name: "asc" } }),
    prisma.location.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
    from ? getPlan(from, user.id) : null,
  ]);
  return (
    <div className="space-y-4">
      <h1 className="h1">New practice plan</h1>
      {source && <p className="text-sm text-slate-600">Starting from the setup of “{source.title}”.</p>}
      <PlanForm
        sports={sports}
        teams={teams}
        coaches={coaches.map((c) => c.name)}
        locations={locations.map((l) => ({ name: l.name, surfaceSlug: l.surfaceSlug }))}
        defaults={source?.input}
      />
    </div>
  );
}
