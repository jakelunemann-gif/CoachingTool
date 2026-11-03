"use client";

import { useMemo, useState } from "react";
import { formatDateShort } from "@/lib/format";
import { BLOCK_TYPE_LABELS, type DrillStat, type RatingComment } from "@/lib/types";

type SortKey = "name" | "plans" | "coaches" | "lastUsed" | "avgRating";

const COLUMNS: { key: SortKey; label: string; className?: string; numeric?: boolean }[] = [
  { key: "name", label: "Drill" },
  { key: "plans", label: "Plans", numeric: true },
  { key: "coaches", label: "Coaches", numeric: true, className: "hidden sm:table-cell" },
  { key: "lastUsed", label: "Last used", className: "hidden md:table-cell" },
  { key: "avgRating", label: "Rating", numeric: true },
];

function compare(a: DrillStat, b: DrillStat, key: SortKey): number {
  if (key === "name") return a.name.localeCompare(b.name);
  if (key === "lastUsed") return a.lastUsed.localeCompare(b.lastUsed);
  if (key === "avgRating") return (a.avgRating ?? -1) - (b.avgRating ?? -1) || a.ratingCount - b.ratingCount;
  return a[key] - b[key];
}

export function DrillStats({ stats, comments }: { stats: DrillStat[]; comments: RatingComment[] }) {
  const [q, setQ] = useState("");
  const [includePrivate, setIncludePrivate] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "plans", desc: true });

  const rows = useMemo(() => {
    const text = q.trim().toLowerCase();
    const list = stats.filter((s) => (includePrivate || !s.isPrivate) && (!text || s.name.toLowerCase().includes(text)));
    // Ties fall back to name so the order is stable.
    return list.sort((a, b) => (sort.desc ? -1 : 1) * compare(a, b, sort.key) || a.name.localeCompare(b.name));
  }, [stats, q, includePrivate, sort]);

  const unused = rows.filter((r) => r.plans === 0).length;
  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "name" }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" placeholder="Search drills…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search drill stats" />
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={includePrivate} onChange={(e) => setIncludePrivate(e.target.checked)} /> Include coaches&apos; private drills
        </label>
        <p className="text-sm text-slate-600">
          {rows.length} drills · {unused} not in any plan
        </p>
      </div>
      <div className="max-h-[32rem] overflow-y-auto">
        <table className="w-full text-sm [&_td]:px-2 [&_th]:px-2 [&_td:first-child]:pl-0 [&_th:first-child]:pl-0 [&_td:last-child]:pr-0 [&_th:last-child]:pr-0" data-testid="drill-stats">
          <thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={`py-1 ${c.numeric ? "text-right" : ""} ${c.className ?? ""}`}
                  aria-sort={sort.key === c.key ? (sort.desc ? "descending" : "ascending") : undefined}
                >
                  <button type="button" className="uppercase tracking-wide hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" onClick={() => toggle(c.key)}>
                    {c.label}
                    {sort.key === c.key && <span aria-hidden> {sort.desc ? "▼" : "▲"}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} data-testid="drill-stat-row">
                <td className="py-1.5">
                  <span className="font-medium text-slate-900">{r.name}</span>
                  <span className="block text-xs text-slate-500">
                    {BLOCK_TYPE_LABELS[r.blockType] ?? r.blockType}
                    {r.isPrivate && " · Private"}
                  </span>
                </td>
                <td className="text-right tabular-nums" data-testid="stat-plans">{r.plans}</td>
                <td className="hidden text-right tabular-nums sm:table-cell" data-testid="stat-coaches">{r.coaches}</td>
                <td className="hidden md:table-cell">{r.lastUsed ? formatDateShort(r.lastUsed) : <span className="text-slate-400">Never</span>}</td>
                <td className="text-right tabular-nums" data-testid="stat-rating">
                  {r.avgRating === null ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <>
                      <span className="text-amber-500" aria-hidden>★</span> {r.avgRating.toFixed(1)} <span className="text-xs text-slate-500">({r.ratingCount})</span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 border-t pt-3">
        <h3 className="font-semibold text-slate-900">Recent comments</h3>
        {comments.length === 0 ? (
          <p className="text-sm text-slate-600">No coach has left a comment yet.</p>
        ) : (
          <ul className="divide-y text-sm" data-testid="rating-comments">
            {comments.map((c) => (
              <li key={c.id} className="py-1.5">
                <p>
                  <span className="text-amber-500" aria-label={`${c.stars} stars`}>{"★".repeat(c.stars)}</span>
                  <span className="text-slate-300" aria-hidden>{"★".repeat(5 - c.stars)}</span> <span className="font-medium">{c.drillName}</span>
                </p>
                <p className="text-slate-700">{c.comment}</p>
                <p className="text-xs text-slate-500">
                  {c.coachName} · {formatDateShort(c.updatedAt.slice(0, 10))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
