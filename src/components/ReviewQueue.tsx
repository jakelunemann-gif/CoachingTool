"use client";

import { useState, useTransition } from "react";
import { approveDrill, rejectDrill, setUserRole } from "@/app/actions";
import type { DrillLite, SportBundle } from "@/lib/types";
import { DrillCard } from "./DrillLibrary";

function ReviewActions({ drill, duplicate }: { drill: DrillLite; duplicate: boolean }) {
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError("");
      try {
        await fn();
      } catch {
        setError("Couldn't update this drill. It may have been changed or deleted. Reload the page.");
      }
    });
  return (
    <div className="space-y-2 border-t pt-2 text-sm">
      <p className="text-xs text-slate-500">Submitted by {drill.submittedBy || "a coach"}</p>
      {duplicate && <p className="text-xs text-amber-800">The library already has a drill with this name.</p>}
      {rejecting ? (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => rejectDrill(drill.id, note)); }}>
          <textarea className="input" rows={2} placeholder="Why not? The coach sees this note (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Reason" autoFocus />
          <div className="flex gap-2">
            <button className="btn btn-sm btn-danger" disabled={pending}>Reject</button>
            <button type="button" className="btn btn-sm" onClick={() => setRejecting(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="flex gap-2">
          <button className="btn btn-sm btn-primary" disabled={pending} onClick={() => run(() => approveDrill(drill.id))}>Approve</button>
          <button className="btn btn-sm" disabled={pending} onClick={() => setRejecting(true)}>Reject…</button>
        </div>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function ReviewQueue({ drills, sports, libraryNames }: { drills: DrillLite[]; sports: SportBundle[]; libraryNames: string[] }) {
  const names = new Set(libraryNames.map((n) => n.toLowerCase()));
  if (drills.length === 0) return <p className="text-sm text-slate-600">Nothing to review right now.</p>;
  return (
    <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      {drills.map((d) => {
        const sport = sports.find((s) => d.sports.includes(s.slug)) ?? sports[0];
        return (
          <DrillCard key={d.id} drill={d} sport={sport} editHref={`/drills/${d.id}?from=review`} showReviewBadge={false}>
            <ReviewActions drill={d} duplicate={names.has(d.name.toLowerCase())} />
          </DrillCard>
        );
      })}
    </div>
  );
}

export function RoleToggle({ userId, isAdmin, isMe }: { userId: string; isAdmin: boolean; isMe: boolean }) {
  const [pending, start] = useTransition();
  if (isMe) return <span className="text-xs text-slate-500">You</span>;
  return (
    <button className="btn btn-sm" disabled={pending} onClick={() => start(() => setUserRole(userId, isAdmin ? "COACH" : "ADMIN"))}>
      {isAdmin ? "Remove admin" : "Make admin"}
    </button>
  );
}
