"use client";

import { useState, useTransition } from "react";
import { clearDrillRating, rateDrill } from "@/app/actions";
import type { DrillRatingSummary } from "@/lib/types";

const EMPTY: DrillRatingSummary = { avg: null, count: 0, mine: null, myComment: "" };

/** Recomputes the average locally so the card updates before the server answers. */
function withMine(s: DrillRatingSummary, stars: number | null): DrillRatingSummary {
  const total = (s.avg ?? 0) * s.count - (s.mine ?? 0) + (stars ?? 0);
  const count = s.count - (s.mine === null ? 0 : 1) + (stars === null ? 0 : 1);
  return { ...s, mine: stars, avg: count ? total / count : null, count, myComment: stars === null ? "" : s.myComment };
}

export function RatingSummary({ avg, count }: { avg: number | null; count: number }) {
  if (!count || avg === null) return <span className="text-slate-500">No ratings yet</span>;
  return (
    <span>
      <span className="text-amber-500" aria-hidden>★</span> {avg.toFixed(1)} · {count} rating{count === 1 ? "" : "s"}
    </span>
  );
}

export function DrillRating({ drillId, drillName, initial }: { drillId: string; drillName: string; initial?: DrillRatingSummary }) {
  const [summary, setSummary] = useState(initial ?? EMPTY);
  const [hover, setHover] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary.myComment);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const save = (stars: number, comment: string) => {
    const before = summary;
    setSummary({ ...withMine(summary, stars), myComment: comment.trim() });
    setError("");
    start(async () => {
      const result = await rateDrill(drillId, stars, comment).catch(() => ({ error: "Couldn't save your rating. Try again." }));
      if (result.error) {
        setSummary(before);
        setError(result.error);
      }
    });
  };

  const clear = () => {
    const before = summary;
    setSummary(withMine(summary, null));
    setDraft("");
    setEditing(false);
    setError("");
    start(async () => {
      await clearDrillRating(drillId).catch(() => {
        setSummary(before);
        setError("Couldn't clear your rating. Try again.");
      });
    });
  };

  const shown = hover ?? summary.mine ?? 0;
  return (
    <div className="space-y-1.5 border-t pt-2 text-xs" data-testid="drill-rating">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-slate-700" data-testid="rating-summary">
          <RatingSummary avg={summary.avg} count={summary.count} />
        </p>
        <div className="flex items-center gap-1">
          <span className="text-slate-500">{summary.mine ? "You:" : "Rate:"}</span>
          <div className="flex" role="group" aria-label={`Your rating for ${drillName}`} onMouseLeave={() => setHover(null)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className="rounded px-0.5 text-lg leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
                aria-pressed={summary.mine === n}
                onMouseEnter={() => setHover(n)}
                onFocus={() => setHover(n)}
                onBlur={() => setHover(null)}
                onClick={() => save(n, summary.myComment)}
                disabled={pending}
              >
                <span className={n <= shown ? "text-amber-500" : "text-slate-300"}>★</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {summary.mine !== null && !editing && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {summary.myComment && <p className="italic text-slate-600">&ldquo;{summary.myComment}&rdquo;</p>}
          <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => { setDraft(summary.myComment); setEditing(true); }}>
            {summary.myComment ? "Edit comment" : "Add a comment"}
          </button>
          <button type="button" className="text-slate-500 hover:underline" onClick={clear} disabled={pending}>Clear rating</button>
        </div>
      )}
      {summary.mine !== null && editing && (
        <form
          className="space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            save(summary.mine!, draft);
            setEditing(false);
          }}
        >
          <textarea
            className="input text-xs"
            rows={2}
            maxLength={500}
            placeholder="How did it go? Admins see this (optional)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={`Comment on ${drillName}`}
            autoFocus
          />
          <div className="flex gap-2">
            <button className="btn btn-sm btn-primary" disabled={pending}>Save comment</button>
            <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}
      {error && <p className="text-red-700">{error}</p>}
    </div>
  );
}
