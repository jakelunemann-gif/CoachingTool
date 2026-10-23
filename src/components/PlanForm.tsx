"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createPlan } from "@/app/actions";
import type { PlanInput, SportBundle, TeamWithPlayers } from "@/lib/types";
import { ChipSelect } from "./ChipSelect";

const DEFAULT_EQUIPMENT = ["helmets", "bases", "tees", "bow-nets", "wiffle-balls", "tennis-balls", "catchers-gear", "cones"];
const DURATIONS = [45, 60, 75, 90, 105, 120];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PlanForm({
  sports,
  teams,
  coaches,
  locations,
  defaults,
}: {
  sports: SportBundle[];
  teams: TeamWithPlayers[];
  coaches: string[];
  locations: { name: string; surfaceSlug: string }[];
  defaults?: Partial<PlanInput>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [sportSlug, setSportSlug] = useState(defaults?.sportSlug ?? sports[0]?.slug ?? "");
  const sport = sports.find((s) => s.slug === sportSlug) ?? sports[0];
  // The source plan's team may have been deleted since.
  const [teamId, setTeamId] = useState(teams.some((t) => t.id === defaults?.teamId) ? defaults!.teamId! : "");
  const team = teams.find((t) => t.id === teamId);
  const [teamName, setTeamName] = useState(defaults?.teamName ?? "");
  const [ageSlug, setAgeSlug] = useState(defaults?.ageSlug ?? "");
  const [skillSlug, setSkillSlug] = useState(defaults?.skillSlug ?? "");
  const [date, setDate] = useState(today());
  const [startTime, setStartTime] = useState(defaults?.startTime ?? "18:00");
  const [durationMin, setDurationMin] = useState(defaults?.durationMin ?? 90);
  const [location, setLocation] = useState(defaults?.location ?? "");
  const [surfaceSlug, setSurfaceSlug] = useState(defaults?.surfaceSlug ?? "field");
  const [equipment, setEquipment] = useState<string[]>(defaults?.equipmentSlugs ?? DEFAULT_EQUIPMENT);
  const [focus, setFocus] = useState<string[]>([]);
  const [coachList, setCoachList] = useState<string[]>(defaults?.coaches ?? []);
  const [extraCoach, setExtraCoach] = useState("");
  const [absent, setAbsent] = useState<string[]>([]);
  const [playerCount, setPlayerCount] = useState(defaults?.playerCount || 12);
  const [options, setOptions] = useState(defaults?.options ?? { intro: false, dailies: true, sideWork: true, endGame: true });
  const [notes, setNotes] = useState("");

  const allCoaches = useMemo(() => [...new Set([...coaches, ...coachList])], [coaches, coachList]);
  const activePlayers = team?.players.filter((p) => p.active) ?? [];
  const present = activePlayers.filter((p) => !absent.includes(p.id));
  const roleLabel = (slug: string) => sport?.config.roles.find((r) => r.slug === slug)?.label ?? slug;

  const pickTeam = (id: string) => {
    setTeamId(id);
    setAbsent([]);
    const t = teams.find((x) => x.id === id);
    if (t) {
      setTeamName(t.name);
      setAgeSlug(t.ageSlug);
      setSkillSlug(t.skillSlug);
      setSportSlug(t.sportSlug);
    }
  };

  const pickSport = (slug: string) => {
    setSportSlug(slug);
    // A saved team belongs to one sport; don't carry its roster into another.
    if (team && team.sportSlug !== slug) {
      setTeamId("");
      setAbsent([]);
    }
  };

  const pickLocation = (name: string) => {
    setLocation(name);
    const loc = locations.find((l) => l.name === name);
    if (loc?.surfaceSlug) setSurfaceSlug(loc.surfaceSlug);
  };

  const addCoach = () => {
    const n = extraCoach.trim();
    if (n && !coachList.includes(n)) setCoachList([...coachList, n]);
    setExtraCoach("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!ageSlug) return setError("Pick an age level.");
    const input: PlanInput = {
      sportSlug,
      teamId: teamId || undefined,
      teamName,
      ageSlug,
      skillSlug,
      date,
      startTime,
      durationMin,
      location,
      surfaceSlug,
      equipmentSlugs: equipment,
      focusSlugs: focus,
      coaches: coachList,
      players: present.map((p) => ({ id: p.id, name: p.name, roles: p.roles })),
      missing: activePlayers.filter((p) => absent.includes(p.id)).map((p) => p.name),
      playerCount: team ? present.length : playerCount,
      options,
      notes,
    };
    startTransition(async () => {
      const res = await createPlan(input);
      if (res.error) setError(res.error);
      else router.push(`/plans/${res.id}`);
    });
  };

  if (!sport) return <p>No sports set up yet. Run <code>npm run db:seed</code>.</p>;
  const tagOptions = (kind: keyof SportBundle["tags"]) => sport.tags[kind].map((t) => ({ value: t.slug, label: t.label }));

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="card grid gap-4 md:grid-cols-3">
        <h2 className="h2 md:col-span-3">Practice details</h2>
        {sports.length > 1 && (
          <div>
            <label className="label" htmlFor="sport">Sport</label>
            <select id="sport" className="input" value={sportSlug} onChange={(e) => pickSport(e.target.value)}>
              {sports.map((s) => (
                <option key={s.slug} value={s.slug}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="team">Saved team</label>
          <select id="team" className="input" value={teamId} onChange={(e) => pickTeam(e.target.value)}>
            <option value="">— No saved team —</option>
            {teams.filter((t) => t.sportSlug === sportSlug).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="teamName">Team name</label>
          <input id="teamName" className="input" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="12U-Blue" />
        </div>
        <div>
          <label className="label" htmlFor="date">Date</label>
          <input id="date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="start">Start time</label>
          <input id="start" type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="duration">Length (minutes)</label>
          <div className="flex gap-2">
            <select id="duration" className="input" value={DURATIONS.includes(durationMin) ? durationMin : "custom"} onChange={(e) => e.target.value !== "custom" && setDurationMin(Number(e.target.value))}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>{d >= 60 ? `${Math.floor(d / 60)}h${d % 60 ? ` ${d % 60}m` : ""}` : `${d}m`}</option>
              ))}
              <option value="custom">Custom…</option>
            </select>
            <input type="number" aria-label="Minutes" className="input w-24" min={15} max={300} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} />
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="location">Location</label>
          <input id="location" className="input" list="locations" value={location} onChange={(e) => pickLocation(e.target.value)} placeholder="MSE Field 12" />
          <datalist id="locations">
            {locations.map((l) => (
              <option key={l.name} value={l.name} />
            ))}
          </datalist>
        </div>
        <div className="md:col-span-3">
          <span className="label">Playing surface</span>
          <ChipSelect name="surface" multiple={false} options={tagOptions("SURFACE")} selected={[surfaceSlug]} onChange={(v) => setSurfaceSlug(v[0] ?? "")} />
        </div>
      </section>

      <section className="card grid gap-4 md:grid-cols-2">
        <h2 className="h2 md:col-span-2">Team</h2>
        <div>
          <span className="label">Age level</span>
          <ChipSelect name="age" multiple={false} options={tagOptions("AGE")} selected={[ageSlug]} onChange={(v) => setAgeSlug(v[0] ?? "")} />
        </div>
        <div>
          <span className="label">Level</span>
          <ChipSelect name="skill" multiple={false} options={tagOptions("SKILL")} selected={[skillSlug]} onChange={(v) => setSkillSlug(v[0] ?? "")} />
        </div>
        <div className="md:col-span-2">
          <span className="label">
            Players {team ? `(${present.length} of ${activePlayers.length} attending; click to mark missing)` : ""}
          </span>
          {team ? (
            activePlayers.length === 0 ? (
              <p className="text-sm text-slate-500">This team has no players yet. Add them on the Teams page.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {activePlayers.map((p) => {
                  const here = !absent.includes(p.id);
                  return (
                    <button
                      type="button"
                      key={p.id}
                      aria-pressed={here}
                      data-chip={`player:${p.name}`}
                      className={`chip ${here ? "chip-on" : "chip-off line-through opacity-60"}`}
                      onClick={() => setAbsent(here ? [...absent, p.id] : absent.filter((x) => x !== p.id))}
                    >
                      {p.name}
                      {p.roles.length > 0 && <span className="ml-1 opacity-75">({p.roles.map((r) => roleLabel(r)[0]).join("/")})</span>}
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <input type="number" aria-label="Number of players" className="input w-28" min={1} max={100} value={playerCount} onChange={(e) => setPlayerCount(Number(e.target.value))} />
          )}
        </div>
        <div className="md:col-span-2">
          <span className="label">Coaches at practice ({coachList.length})</span>
          <div className="flex flex-wrap items-center gap-2">
            <ChipSelect name="coach" options={allCoaches.map((c) => ({ value: c, label: c }))} selected={coachList} onChange={setCoachList} />
            <input
              className="input w-40"
              placeholder="Add coach"
              aria-label="Add coach"
              value={extraCoach}
              onChange={(e) => setExtraCoach(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCoach();
                }
              }}
            />
            <button type="button" className="btn btn-sm" onClick={addCoach}>Add</button>
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="h2">What do you want to work on?</h2>
        <ChipSelect name="focus" options={tagOptions("FOCUS")} selected={focus} onChange={setFocus} />
        <div>
          <span className="label">Equipment available</span>
          <ChipSelect name="equipment" options={tagOptions("EQUIPMENT")} selected={equipment} onChange={setEquipment} />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          {(
            [
              ["intro", "Introductions / meeting"],
              ["dailies", "Dailies"],
              ["sideWork", "Pitcher/catcher side work"],
              ["endGame", "End with a game"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-1.5">
              <input type="checkbox" checked={options[key]} onChange={(e) => setOptions({ ...options, [key]: e.target.checked })} />
              {label}
            </label>
          ))}
        </div>
        <div>
          <label className="label" htmlFor="notes">Notes for next practice (one per line)</label>
          <textarea id="notes" className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Wednesday at MSE Gym 2 7:30-9pm, CAGES!" />
        </div>
      </section>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary px-5 py-2 text-base" disabled={pending}>
          {pending ? "Building plan…" : "Build practice plan"}
        </button>
      </div>
    </form>
  );
}
