import { notFound } from "next/navigation";
import { TeamEditor } from "@/components/TeamEditor";
import { getSports, getTeams } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [teams, sports] = await Promise.all([getTeams(), getSports()]);
  const team = teams.find((t) => t.id === id);
  if (!team) notFound();
  return (
    <div className="space-y-4">
      <h1 className="h1">{team.name}</h1>
      <TeamEditor team={team} sports={sports} />
    </div>
  );
}
