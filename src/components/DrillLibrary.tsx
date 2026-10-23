"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BLOCK_TYPE_LABELS, BLOCK_TYPES, type DrillLite, type SportBundle } from "@/lib/types";
import { videoInfo } from "@/lib/video";
import { ChipSelect } from "./ChipSelect";

export function ageRange(ages: string[], order: { slug: string; label: string }[]): string {
  if (ages.length === 0) return "All ages";
  const idx = ages.map((a) => order.findIndex((o) => o.slug === a)).filter((i) => i >= 0).sort((a, b) => a - b);
  if (idx.length === 0) return ages.join(", ");
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  const label = (i: number) => order[i].label;
  if (!contiguous) return idx.map(label).join(", ");
  if (idx.length === 1) return label(idx[0]);
  return idx[idx.length - 1] === order.length - 1 ? `${label(idx[0])}+` : `${label(idx[0])}–${label(idx[idx.length - 1])}`;
}

function DrillCard({ drill, sport }: { drill: DrillLite; sport: SportBundle }) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const label = (kind: "FOCUS" | "EQUIPMENT" | "SURFACE", slug: string) => sport.tags[kind].find((t) => t.slug === slug)?.label ?? slug;
  const video = drill.videos[0];
  const info = video ? videoInfo(video.url) : undefined;
  return (
    <article className="card flex flex-col gap-2" data-testid="drill-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">{drill.name}</h3>
          <p className="text-xs text-slate-500">
            {BLOCK_TYPE_LABELS[drill.blockType]} · {drill.durationTypical} min ({drill.durationMin}–{drill.durationMax}) · {drill.coachesRequired} coach{drill.coachesRequired === 1 ? "" : "es"} · {ageRange(drill.ages, sport.tags.AGE)}
          </p>
        </div>
        <Link href={`/drills/${drill.id}`} className="btn btn-sm shrink-0">Edit</Link>
      </div>
      {drill.source === "needs review" && <span className="w-fit rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">Needs review: check the description</span>}
      {drill.description && <p className="text-sm text-slate-700">{drill.description}</p>}
      <div className="flex flex-wrap gap-1">
        {drill.focus.map((f) => (
          <span key={f} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700">{label("FOCUS", f)}</span>
        ))}
        {drill.surfaces.map((s) => (
          <span key={s} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">{label("SURFACE", s)}</span>
        ))}
        {drill.equipment.map((e) => (
          <span key={e} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{label("EQUIPMENT", e)}</span>
        ))}
      </div>
      {video && info && (
        <div>
          {playing && info.embedUrl ? (
            <iframe className="aspect-video w-full rounded" src={info.embedUrl} title={drill.name} allow="encrypted-media; picture-in-picture" allowFullScreen />
          ) : info.thumbnail ? (
            <button className="group relative block w-full overflow-hidden rounded" onClick={() => setPlaying(true)} aria-label={`Play video for ${drill.name}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={info.thumbnail} alt="" className="aspect-video w-full object-cover" loading="lazy" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-3xl text-white group-hover:bg-black/30">▶</span>
            </button>
          ) : null}
          <a href={video.url} target="_blank" rel="noreferrer" className="text-xs text-brand-700 hover:underline">
            {video.label || "Watch video"} ↗
          </a>
          {info.kind === "drive" && !playing && (
            <button className="ml-3 text-xs text-brand-700 hover:underline" onClick={() => setPlaying(true)}>Preview here</button>
          )}
          {drill.videos.length > 1 && <span className="ml-2 text-xs text-slate-500">+{drill.videos.length - 1} more</span>}
        </div>
      )}
      {drill.instructions.length > 0 && (
        <button className="w-fit text-xs font-medium text-brand-700 hover:underline" onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Show"} coaching points ({drill.instructions.length})
        </button>
      )}
      {open && (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">
          {drill.instructions.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function DrillLibrary({ drills, sports }: { drills: DrillLite[]; sports: SportBundle[] }) {
  const [sportSlug, setSportSlug] = useState(sports[0]?.slug ?? "");
  const sport = sports.find((s) => s.slug === sportSlug) ?? sports[0];
  const [q, setQ] = useState("");
  const [age, setAge] = useState("");
  const [focus, setFocus] = useState<string[]>([]);
  const [surface, setSurface] = useState("");
  const [blockType, setBlockType] = useState("");
  const [coaches, setCoaches] = useState("");
  const [videoOnly, setVideoOnly] = useState(false);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return drills.filter(
      (d) =>
        d.sports.includes(sportSlug) &&
        (!text || `${d.name} ${d.description} ${d.instructions.join(" ")}`.toLowerCase().includes(text)) &&
        (!age || d.ages.length === 0 || d.ages.includes(age)) &&
        (focus.length === 0 || focus.some((f) => d.focus.includes(f))) &&
        (!surface || d.surfaces.length === 0 || d.surfaces.includes(surface)) &&
        (!blockType || d.blockType === blockType) &&
        (!coaches || d.coachesRequired <= Number(coaches)) &&
        (!videoOnly || d.videos.length > 0),
    );
  }, [drills, sportSlug, q, age, focus, surface, blockType, coaches, videoOnly]);

  if (!sport) return null;
  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="grid gap-3 md:grid-cols-6">
          <input className="input md:col-span-2" placeholder="Search drills…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search drills" />
          {sports.length > 1 && (
            <select className="input" value={sportSlug} onChange={(e) => setSportSlug(e.target.value)} aria-label="Sport">
              {sports.map((s) => (
                <option key={s.slug} value={s.slug}>{s.name}</option>
              ))}
            </select>
          )}
          <select className="input" value={age} onChange={(e) => setAge(e.target.value)} aria-label="Age">
            <option value="">Any age</option>
            {sport.tags.AGE.map((t) => (
              <option key={t.slug} value={t.slug}>{t.label}</option>
            ))}
          </select>
          <select className="input" value={surface} onChange={(e) => setSurface(e.target.value)} aria-label="Surface">
            <option value="">Any surface</option>
            {sport.tags.SURFACE.map((t) => (
              <option key={t.slug} value={t.slug}>{t.label}</option>
            ))}
          </select>
          <select className="input" value={blockType} onChange={(e) => setBlockType(e.target.value)} aria-label="Type">
            <option value="">Any type</option>
            {BLOCK_TYPES.map((b) => (
              <option key={b} value={b}>{BLOCK_TYPE_LABELS[b]}</option>
            ))}
          </select>
          <select className="input" value={coaches} onChange={(e) => setCoaches(e.target.value)} aria-label="Coaches">
            <option value="">Any # coaches</option>
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>≤ {n} coach{n === 1 ? "" : "es"}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={videoOnly} onChange={(e) => setVideoOnly(e.target.checked)} /> Has video
          </label>
        </div>
        <ChipSelect name="focus" options={sport.tags.FOCUS.map((t) => ({ value: t.slug, label: t.label }))} selected={focus} onChange={setFocus} />
      </div>
      <p className="text-sm text-slate-600">{filtered.length} drills</p>
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((d) => (
          <DrillCard key={d.id} drill={d} sport={sport} />
        ))}
      </div>
    </div>
  );
}
