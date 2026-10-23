import { PlanForm } from "@/components/PlanForm";
import { getPlan, getSports, getTeams } from "@/lib/data";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewPlanPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const [sports, teams, coaches, locations, source] = await Promise.all([
    getSports(),
    getTeams(),
    prisma.coach.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    from ? getPlan(from) : null,
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
