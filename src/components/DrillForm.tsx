"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteDrill, resubmitDrill, saveDrill } from "@/app/actions";
import { BLOCK_TYPE_LABELS, BLOCK_TYPES, type BlockType, type DrillLite, type SportBundle, type TagKind } from "@/lib/types";
import { ChipSelect } from "./ChipSelect";

const TAG_SECTIONS: { kind: TagKind; label: string; hint: string }[] = [
  { kind: "FOCUS", label: "Focus areas", hint: "What this drill works on" },
  { kind: "AGE", label: "Age levels", hint: "Leave empty for all ages" },
  { kind: "SKILL", label: "Levels", hint: "Leave empty for all levels" },
  { kind: "SURFACE", label: "Surfaces", hint: "Where it can run. Leave empty for anywhere" },
  { kind: "EQUIPMENT", label: "Required equipment", hint: "Only suggested when all of these are available" },
];

export function DrillForm({
  drill,
  sports,
  canAddToLibrary = false,
  returnTo = "/drills",
}: {
  drill?: DrillLite;
  sports: SportBundle[];
  // Admins adding a new drill choose between the shared library and private.
  canAddToLibrary?: boolean;
  returnTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [name, setName] = useState(drill?.name ?? "");
  const [blockType, setBlockType] = useState<BlockType>(drill?.blockType ?? "STATION");
  const [description, setDescription] = useState(drill?.description ?? "");
  const [instructions, setInstructions] = useState(drill?.instructions.join("\n") ?? "");
  const [durationMin, setDurationMin] = useState(drill?.durationMin ?? 6);
  const [durationTypical, setDurationTypical] = useState(drill?.durationTypical ?? 8);
  const [durationMax, setDurationMax] = useState(drill?.durationMax ?? 12);
  const [coachesRequired, setCoachesRequired] = useState(drill?.coachesRequired ?? 1);
  const [minPlayers, setMinPlayers] = useState(drill?.minPlayers ?? 1);
  const [maxPlayers, setMaxPlayers] = useState<number | "">(drill?.maxPlayers ?? "");
  const [source, setSource] = useState(drill?.source ?? "");
  const [sportSlugs, setSportSlugs] = useState<string[]>(drill?.sports ?? sports.map((s) => s.slug));
  const [videos, setVideos] = useState(drill?.videos.length ? drill.videos : [{ url: "", label: "" }]);
  const [addToLibrary, setAddToLibrary] = useState(canAddToLibrary);

  // Tags available for the selected sports (deduplicated by id).
  const tagsFor = (kind: TagKind) => {
    const seen = new Map<string, { id: string; slug: string; label: string }>();
    sports.filter((s) => sportSlugs.includes(s.slug)).forEach((s) => s.tags[kind].forEach((t) => seen.set(t.id, t)));
    return [...seen.values()];
  };
  const initialTagIds = () => {
    if (!drill) return [];
    const bySlug: Record<TagKind, string[]> = { FOCUS: drill.focus, AGE: drill.ages, SKILL: drill.skills, SURFACE: drill.surfaces, EQUIPMENT: drill.equipment };
    const ids = new Set<string>();
    for (const s of sports) for (const kind of Object.keys(bySlug) as TagKind[]) s.tags[kind].filter((t) => bySlug[kind].includes(t.slug)).forEach((t) => ids.add(t.id));
    return [...ids];
  };
  const [tagIds, setTagIds] = useState<string[]>(initialTagIds);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await saveDrill({
        id: drill?.id,
        name,
        blockType,
        description,
        instructions,
        durationMin,
        durationTypical,
        durationMax,
        coachesRequired,
        minPlayers,
        maxPlayers: maxPlayers === "" ? null : maxPlayers,
        source,
        sportSlugs,
        tagIds,
        videos: videos.filter((v) => v.url.trim()),
        addToLibrary: !drill && addToLibrary,
      });
      if (res.error) setError(res.error);
      else router.push(returnTo);
    });
  };

  const num = (value: number, set: (n: number) => void, label: string, min = 0) => (
    <div>
      <label className="label">{label}</label>
      <input type="number" className="input" min={min} value={value} onChange={(e) => set(Number(e.target.value))} aria-label={label} />
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      {drill?.ownerId && <ReviewStatusBanner drill={drill} onResubmit={() => startTransition(async () => { await resubmitDrill(drill.id); router.refresh(); })} />}
      <section className="card grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="label" htmlFor="name">Name</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="blockType">Used as</label>
          <select id="blockType" className="input" value={blockType} onChange={(e) => setBlockType(e.target.value as BlockType)}>
            {BLOCK_TYPES.map((b) => (
              <option key={b} value={b}>{BLOCK_TYPE_LABELS[b]}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="label" htmlFor="description">Short description</label>
          <textarea id="description" className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="md:col-span-3">
          <label className="label" htmlFor="instructions">Coaching points / setup (one per line; these go into the plan)</label>
          <textarea id="instructions" className="input" rows={5} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3 md:col-span-3 md:grid-cols-6">
          {num(durationMin, setDurationMin, "Min minutes", 1)}
          {num(durationTypical, setDurationTypical, "Typical minutes", 1)}
          {num(durationMax, setDurationMax, "Max minutes", 1)}
          {num(coachesRequired, setCoachesRequired, "Coaches needed")}
          {num(minPlayers, setMinPlayers, "Min players", 1)}
          <div>
            <label className="label">Max players</label>
            <input type="number" className="input" min={1} value={maxPlayers} placeholder="any" onChange={(e) => setMaxPlayers(e.target.value ? Number(e.target.value) : "")} aria-label="Max players" />
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Videos</h2>
        {videos.map((v, i) => (
          <div key={i} className="flex gap-2">
            <input className="input" placeholder="https://youtu.be/…" value={v.url} onChange={(e) => setVideos(videos.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} aria-label="Video URL" />
            <input className="input w-48" placeholder="Label (optional)" value={v.label} onChange={(e) => setVideos(videos.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} aria-label="Video label" />
            <button type="button" className="btn btn-sm btn-danger" onClick={() => setVideos(videos.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="btn btn-sm" onClick={() => setVideos([...videos, { url: "", label: "" }])}>+ Add video link</button>
        <p className="text-xs text-slate-500">YouTube (including Shorts and ?t= start times) and Google Drive links play right in the library.</p>
      </section>

      <section className="card space-y-4">
        <h2 className="h2">Tags</h2>
        {sports.length > 1 && (
          <div>
            <span className="label">Sports</span>
            <ChipSelect name="sports" options={sports.map((s) => ({ value: s.slug, label: s.name }))} selected={sportSlugs} onChange={setSportSlugs} />
          </div>
        )}
        {TAG_SECTIONS.map(({ kind, label, hint }) => {
          const options = tagsFor(kind);
          const ids = new Set(options.map((o) => o.id));
          return (
            <div key={kind}>
              <span className="label">{label} <span className="normal-case tracking-normal text-slate-400">· {hint}</span></span>
              <ChipSelect
                name={kind.toLowerCase()}
                options={options.map((t) => ({ value: t.id, label: t.label }))}
                selected={tagIds.filter((id) => ids.has(id))}
                onChange={(next) => setTagIds([...tagIds.filter((id) => !ids.has(id)), ...next])}
              />
            </div>
          );
        })}
        <div>
          <label className="label" htmlFor="source">Source / notes</label>
          <input id="source" className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder='e.g. "Coach plans 2026" or "needs review"' />
        </div>
      </section>

      {!drill && canAddToLibrary && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={addToLibrary} onChange={(e) => setAddToLibrary(e.target.checked)} />
          Add to the shared library (uncheck to keep it private)
        </label>
      )}
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex justify-between">
        {drill ? (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() =>
              confirm(`Delete "${drill.name}"?`) &&
              startTransition(async () => {
                await deleteDrill(drill.id);
                router.push(returnTo);
              })
            }
          >
            Delete drill
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save drill"}</button>
      </div>
    </form>
  );
}

function ReviewStatusBanner({ drill, onResubmit }: { drill: DrillLite; onResubmit: () => void }) {
  if (drill.reviewStatus === "PENDING") {
    return <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Private drill · waiting for an admin to review it for the shared library.</p>;
  }
  if (drill.reviewStatus === "REJECTED") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
        <span>
          Private drill · not added to the shared library{drill.reviewNote ? `: “${drill.reviewNote}”` : "."} You can still use it in your plans.
        </span>
        <button type="button" className="btn btn-sm" onClick={onResubmit}>Resubmit for review</button>
      </div>
    );
  }
  return <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">Private drill · only you can see it.</p>;
}
