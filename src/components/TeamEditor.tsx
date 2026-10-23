"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteTeam, saveTeam } from "@/app/actions";
import type { SportBundle, TeamWithPlayers } from "@/lib/types";
import { ChipSelect } from "./ChipSelect";

type Row = { id?: string; name: string; roles: string[]; active: boolean };

export function TeamEditor({ team, sports }: { team?: TeamWithPlayers; sports: SportBundle[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [name, setName] = useState(team?.name ?? "");
  const [sportSlug, setSportSlug] = useState(team?.sportSlug ?? sports[0]?.slug ?? "");
  const [ageSlug, setAgeSlug] = useState(team?.ageSlug ?? "");
  const [skillSlug, setSkillSlug] = useState(team?.skillSlug ?? "");
  const [season, setSeason] = useState(team?.season ?? "");
  const [players, setPlayers] = useState<Row[]>(team?.players ?? []);
  const [bulk, setBulk] = useState("");
  const sport = sports.find((s) => s.slug === sportSlug) ?? sports[0];

  const setRow = (i: number, change: Partial<Row>) => setPlayers(players.map((p, j) => (j === i ? { ...p, ...change } : p)));
  const addBulk = () => {
    const names = bulk.split(/\n|,/).map((n) => n.trim()).filter(Boolean);
    setPlayers([...players, ...names.map((n) => ({ name: n, roles: [], active: true }))]);
    setBulk("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await saveTeam({ id: team?.id, name, sportSlug, ageSlug, skillSlug, season, players });
      if (res.error) setError(res.error);
      else router.push("/teams");
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="card grid gap-4 md:grid-cols-3">
        <div>
          <label className="label" htmlFor="name">Team name</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="12U-Blue" required />
        </div>
        {sports.length > 1 && (
          <div>
            <label className="label" htmlFor="sport">Sport</label>
            <select id="sport" className="input" value={sportSlug} onChange={(e) => setSportSlug(e.target.value)}>
              {sports.map((s) => (
                <option key={s.slug} value={s.slug}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="season">Season</label>
          <input id="season" className="input" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="Spring 2026" />
        </div>
        <div className="md:col-span-3">
          <span className="label">Age level</span>
          <ChipSelect name="age" multiple={false} options={sport.tags.AGE.map((t) => ({ value: t.slug, label: t.label }))} selected={[ageSlug]} onChange={(v) => setAgeSlug(v[0] ?? "")} />
        </div>
        <div className="md:col-span-3">
          <span className="label">Level</span>
          <ChipSelect name="skill" multiple={false} options={sport.tags.SKILL.map((t) => ({ value: t.slug, label: t.label }))} selected={[skillSlug]} onChange={(v) => setSkillSlug(v[0] ?? "")} />
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Roster ({players.length})</h2>
        <p className="text-xs text-slate-500">
          Roles decide circuit groups (catchers are spread across groups) and pitcher/catcher pairings. Turn off &quot;active&quot; for players who left the team.
        </p>
        <div className="space-y-1.5">
          {players.map((p, i) => (
            <div key={p.id ?? `new-${i}`} className="flex flex-wrap items-center gap-2" data-testid="roster-row">
              <input className="input w-48" value={p.name} onChange={(e) => setRow(i, { name: e.target.value })} aria-label="Player name" />
              {sport.config.roles.map((r) => (
                <label key={r.slug} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={p.roles.includes(r.slug)} onChange={(e) => setRow(i, { roles: e.target.checked ? [...p.roles, r.slug] : p.roles.filter((x) => x !== r.slug) })} aria-label={`${p.name} ${r.label}`} />
                  {r.label}
                </label>
              ))}
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={p.active} onChange={(e) => setRow(i, { active: e.target.checked })} /> active
              </label>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => setPlayers(players.filter((_, j) => j !== i))} aria-label={`Remove ${p.name}`}>✕</button>
            </div>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="label" htmlFor="bulk">Add players (one per line or comma-separated)</label>
            <textarea id="bulk" className="input" rows={2} value={bulk} onChange={(e) => setBulk(e.target.value)} />
          </div>
          <button type="button" className="btn" onClick={addBulk}>Add</button>
        </div>
      </section>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex justify-between">
        {team ? (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() =>
              confirm(`Delete ${team.name}? Its plans are kept.`) &&
              startTransition(async () => {
                await deleteTeam(team.id);
                router.push("/teams");
              })
            }
          >
            Delete team
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save team"}</button>
      </div>
    </form>
  );
}
