"use client";

import { signIn, signOut } from "next-auth/react";
import { useState, useTransition } from "react";
import { addCoach, addLocation, addTag, changePassword, removeCoach, removeLocation, setUserPreference } from "@/app/actions";
import type { SportBundle, TagKind } from "@/lib/types";

export function CoachesForm({ coaches }: { coaches: { id: string; name: string }[] }) {
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-1.5">
        {coaches.map((c) => (
          <li key={c.id} className="chip chip-off gap-1">
            {c.name}
            <button aria-label={`Remove ${c.name}`} onClick={() => start(() => removeCoach(c.id))}>✕</button>
          </li>
        ))}
        {coaches.length === 0 && <li className="text-sm text-slate-500">No coaches saved yet.</li>}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { await addCoach(name); setName(""); }); }}>
        <input className="input w-56" placeholder="Coach name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Coach name" />
        <button className="btn" disabled={pending || !name.trim()}>Add coach</button>
      </form>
    </div>
  );
}

export function LocationsForm({ locations, surfaces }: { locations: { id: string; name: string; surfaceSlug: string }[]; surfaces: { slug: string; label: string }[] }) {
  const [name, setName] = useState("");
  const [surface, setSurface] = useState(surfaces[0]?.slug ?? "");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <ul className="divide-y text-sm">
        {locations.map((l) => (
          <li key={l.id} className="flex items-center justify-between py-1.5">
            <span>{l.name} <span className="text-slate-500">· {surfaces.find((s) => s.slug === l.surfaceSlug)?.label ?? "any surface"}</span></span>
            <button className="btn btn-sm btn-danger" onClick={() => start(() => removeLocation(l.id))} aria-label={`Remove ${l.name}`}>✕</button>
          </li>
        ))}
        {locations.length === 0 && <li className="py-1.5 text-slate-500">No locations saved yet.</li>}
      </ul>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { await addLocation(name, surface); setName(""); }); }}>
        <input className="input w-56" placeholder="MSE Field 12" value={name} onChange={(e) => setName(e.target.value)} aria-label="Location name" />
        <select className="input w-40" value={surface} onChange={(e) => setSurface(e.target.value)} aria-label="Location surface">
          {surfaces.map((s) => (
            <option key={s.slug} value={s.slug}>{s.label}</option>
          ))}
        </select>
        <button className="btn" disabled={pending || !name.trim()}>Add location</button>
      </form>
    </div>
  );
}

export function DriveSettings({ folderId, googleConfigured, signedInAs }: { folderId: string; googleConfigured: boolean; signedInAs?: string | null }) {
  const [value, setValue] = useState(folderId);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const parsed = value.match(/folders\/([\w-]+)/)?.[1] ?? value.trim();
  return (
    <div className="space-y-3 text-sm">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { await setUserPreference("driveFolderId", parsed); setValue(parsed); setSaved(true); }); }}>
        <input className="input max-w-md" value={value} onChange={(e) => { setValue(e.target.value); setSaved(false); }} placeholder="Folder link or ID" aria-label="Drive folder" />
        <button className="btn" disabled={pending}>Save folder</button>
        {saved && <span className="self-center text-emerald-700">Saved</span>}
      </form>
      {!googleConfigured ? (
        <p className="rounded-md bg-amber-50 p-3 text-amber-900">
          Google sign-in isn&apos;t set up. Add <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> and <code>NEXTAUTH_SECRET</code> to <code>.env</code>. The README has step-by-step instructions.
        </p>
      ) : signedInAs ? (
        <p>
          Signed in to Google as <b>{signedInAs}</b>. <button className="text-brand-700 underline" onClick={() => signOut()}>Sign out</button>
        </p>
      ) : (
        <button className="btn" onClick={() => signIn("google")}>Connect Google Drive</button>
      )}
    </div>
  );
}

export function AddTagForm({ sports }: { sports: SportBundle[] }) {
  const [kind, setKind] = useState<TagKind>("FOCUS");
  const [label, setLabel] = useState("");
  const [sportSlug, setSportSlug] = useState(sports[0]?.slug ?? "");
  const [pending, start] = useTransition();
  return (
    <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { await addTag(kind, label, sportSlug); setLabel(""); }); }}>
      <select className="input w-40" value={kind} onChange={(e) => setKind(e.target.value as TagKind)} aria-label="Tag type">
        <option value="FOCUS">Focus area</option>
        <option value="EQUIPMENT">Equipment</option>
        <option value="SURFACE">Surface</option>
        <option value="AGE">Age level</option>
        <option value="SKILL">Level</option>
      </select>
      {sports.length > 1 && (
        <select className="input w-36" value={sportSlug} onChange={(e) => setSportSlug(e.target.value)} aria-label="Sport">
          {sports.map((s) => (
            <option key={s.slug} value={s.slug}>{s.name}</option>
          ))}
        </select>
      )}
      <input className="input w-56" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Pickoffs" aria-label="Tag label" />
      <button className="btn" disabled={pending || !label.trim()}>Add</button>
    </form>
  );
}

export function DefaultSportForm({ sports }: { sports: SportBundle[] }) {
  const [pending, start] = useTransition();
  return (
    <select
      className="input w-48"
      defaultValue={sports[0]?.slug}
      disabled={pending}
      aria-label="Default sport"
      onChange={(e) => start(() => setUserPreference("defaultSport", e.target.value))}
    >
      {sports.map((s) => (
        <option key={s.slug} value={s.slug}>{s.name}</option>
      ))}
    </select>
  );
}

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap gap-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await changePassword(current, next);
          setMessage(res.error ? { ok: false, text: res.error } : { ok: true, text: "Password changed" });
          if (!res.error) { setCurrent(""); setNext(""); }
        });
      }}
    >
      <input type="password" className="input w-48" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} aria-label="Current password" autoComplete="current-password" />
      <input type="password" className="input w-48" placeholder="New password" value={next} onChange={(e) => setNext(e.target.value)} aria-label="New password" autoComplete="new-password" />
      <button className="btn" disabled={pending || !current || !next}>Change password</button>
      {message && <span className={`self-center ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</span>}
    </form>
  );
}
