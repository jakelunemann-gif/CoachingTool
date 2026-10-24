import Link from "next/link";
import { TeamEditor } from "@/components/TeamEditor";
import { requireUser } from "@/lib/auth/session";
import { getSports, getTeams } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const user = await requireUser();
  const [teams, sports] = await Promise.all([getTeams(user.id), getSports(user)]);
  const label = (sportSlug: string, kind: "AGE" | "SKILL", slug: string) =>
    sports.find((s) => s.slug === sportSlug)?.tags[kind].find((t) => t.slug === slug)?.label ?? "";
  return (
    <div className="space-y-6">
      <h1 className="h1">Teams</h1>
      {teams.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-3">
          {teams.map((t) => (
            <li key={t.id}>
              <Link href={`/teams/${t.id}`} className="card block hover:border-brand-500">
                <div className="font-semibold">{t.name}</div>
                <div className="text-xs text-slate-500">
                  {[label(t.sportSlug, "AGE", t.ageSlug), label(t.sportSlug, "SKILL", t.skillSlug), t.season].filter(Boolean).join(" · ")} · {t.players.filter((p) => p.active).length} players
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div>
        <h2 className="h2 mb-3">Add a team</h2>
        <TeamEditor sports={sports} />
      </div>
    </div>
  );
}
