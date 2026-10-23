"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { deletePlan, regeneratePlan, savePlan } from "@/app/actions";
import type { PlanRecord } from "@/lib/data";
import { groupLine, planToDocModel } from "@/lib/export/docModel";
import { clockAt, numberWord } from "@/lib/format";
import { alternatives, compatibleTypes, displayTitles, drillToItem, startOffsets, totalMinutes, withRotation } from "@/lib/generator";
import { BLOCK_TYPE_LABELS, type BlockType, type DrillLite, type PlanGroup, type PlanItem } from "@/lib/types";
import { PlanDocument } from "./PlanDocument";

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`);

const linesToText = (lines: string[]) => lines.join("\n");
const textToLines = (text: string) => text.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());

/** Parse the groups textarea: "Group 1: Aura, Piper" or "Group 1 (4 players)" per line. */
function parseGroups(text: string, prev: PlanGroup[]): PlanGroup[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const colon = line.indexOf(":");
      if (colon >= 0) {
        const players = line.slice(colon + 1).split(",").map((p) => p.trim()).filter(Boolean);
        return { name: line.slice(0, colon).trim() || `Group ${i + 1}`, players, size: players.length || prev[i]?.size || 0 };
      }
      const count = line.match(/^(.*?)\s*\((\d+) players?\)$/);
      if (count) return { name: count[1] || `Group ${i + 1}`, players: [], size: Number(count[2]) };
      return { name: line, players: [], size: prev[i]?.size ?? 0 };
    });
}

/** Re-split groups to `count`, moving players from dropped groups instead of losing them. */
function resizeGroups(groups: PlanGroup[], count: number): PlanGroup[] {
  if (groups.length === 0) return groups;
  const n = Math.max(1, count);
  const out = groups.slice(0, n).map((g) => ({ ...g, players: [...g.players] }));
  while (out.length < n) out.push({ name: `Group ${out.length + 1}`, players: [], size: 0 });
  const bySize = () => [...out].sort((a, b) => a.size - b.size);
  for (const g of groups.slice(n)) {
    for (let k = 0; k < g.size; k++) {
      const smallest = bySize()[0];
      if (g.players[k]) smallest.players.push(g.players[k]);
      smallest.size += 1;
    }
  }
  for (let guard = 0; guard < 200; guard++) {
    const sorted = bySize();
    const small = sorted[0];
    const big = sorted[sorted.length - 1];
    if (big.size - small.size <= 1) break;
    const p = big.players.pop();
    if (p) small.players.push(p);
    big.size -= 1;
    small.size += 1;
  }
  return out;
}

/** A circuit or breakout with a new set of stations; circuits keep times and groups in step. */
function withStations(item: PlanItem, children: PlanItem[]): PlanItem {
  if (item.kind !== "circuit") return { ...item, children };
  const lines = item.lines.map((l, i) => (i === 0 ? l.replace(/Split into (\w+ )?even groups/, `Split into ${numberWord(Math.max(1, children.length))} even groups`) : l));
  return withRotation({ ...item, children, lines, groups: item.groups && resizeGroups(item.groups, children.length) }, item.rotateMinutes ?? 8);
}

/** Edits groups as free text and applies them on blur, so typing commas and spaces isn't undone mid-word. */
function GroupsField({ groups, onCommit }: { groups: PlanGroup[]; onCommit: (groups: PlanGroup[]) => void }) {
  const [text, setText] = useState(() => groups.map(groupLine).join("\n"));
  return (
    <textarea
      className="input text-sm"
      rows={Math.max(1, groups.length)}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(parseGroups(text, groups))}
      aria-label="Groups"
    />
  );
}

/** Replace the drill in an item, keeping its slot (kind, time, coach, who). */
function swapDrill(item: PlanItem, drill: DrillLite, oldDrill?: DrillLite): PlanItem {
  // Keep a "Play Catch: " / "Game: " style prefix from the old title.
  const prefix = oldDrill && item.title.endsWith(oldDrill.name) ? item.title.slice(0, item.title.length - oldDrill.name.length) : "";
  const keep = item.lines.filter((l) => /^(Team leader|Missing):/.test(l));
  return {
    ...item,
    title: `${prefix}${drill.name}`,
    drillId: drill.id,
    blockType: drill.blockType,
    videoUrl: drill.videos[0]?.url,
    lines: [...keep, ...drill.instructions],
  };
}

function DrillPicker({
  drills,
  plan,
  types,
  currentId,
  usedIds,
  onPick,
  onClose,
}: {
  drills: DrillLite[];
  plan: PlanRecord;
  types: BlockType[];
  currentId?: string;
  usedIds: Set<string>;
  onPick: (d: DrillLite) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  // Drills already in the plan sort after the other drills that fit.
  const list = useMemo(
    () => alternatives(drills, plan.input, types, currentId).sort((a, b) => Number(!!a.reason) - Number(!!b.reason) || Number(usedIds.has(a.drill.id)) - Number(usedIds.has(b.drill.id))),
    [drills, plan.input, types, currentId, usedIds],
  );
  const filtered = list.filter(({ drill, reason }) => (showAll || !reason) && (!q || drill.name.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-16" onClick={onClose}>
      <div className="card max-h-[75vh] w-full max-w-xl overflow-hidden p-0" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Pick a drill">
        <div className="flex items-center gap-2 border-b p-3">
          <input autoFocus className="input" placeholder="Search drills…" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="flex shrink-0 items-center gap-1 text-xs">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> show all
          </label>
          <button className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
        <ul className="max-h-[60vh] divide-y overflow-y-auto">
          {filtered.length === 0 && <li className="p-4 text-sm text-slate-500">No matching drills. Try “show all” or add one in the Drill Library.</li>}
          {filtered.map(({ drill, reason }) => (
            <li key={drill.id}>
              <button className={`w-full p-3 text-left hover:bg-brand-50 ${reason ? "opacity-60" : ""}`} onClick={() => onPick(drill)}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{drill.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {drill.durationTypical} min · {BLOCK_TYPE_LABELS[drill.blockType]}
                  </span>
                </div>
                {drill.description && <p className="text-xs text-slate-600">{drill.description}</p>}
                {usedIds.has(drill.id) && <p className="text-xs text-slate-500">Already in this plan</p>}
                {reason && <p className="text-xs text-amber-700">Doesn&apos;t fit: {reason}</p>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SortableCard({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const handle = (
    <button type="button" className="cursor-grab touch-none px-1 text-slate-400 hover:text-slate-700" aria-label="Drag to reorder" {...attributes} {...listeners}>
      ⠿
    </button>
  );
  return (
    <div ref={setNodeRef} style={style}>
      {children(handle)}
    </div>
  );
}

export function PlanEditor({ plan, drills }: { plan: PlanRecord; drills: DrillLite[] }) {
  const router = useRouter();
  const [items, setItems] = useState<PlanItem[]>(plan.items);
  const [title, setTitle] = useState(plan.title);
  const [location, setLocation] = useState(plan.location);
  const [showTimes, setShowTimes] = useState(plan.showTimes);
  const [warnings, setWarnings] = useState(plan.warnings);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [picker, setPicker] = useState<{ types: BlockType[]; currentId?: string; onPick: (d: DrillLite) => void } | null>(null);
  const drillById = useMemo(() => new Map(drills.map((d) => [d.id, d])), [drills]);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (next: PlanItem[]) => {
    setItems(next);
    setDirty(true);
  };
  const patch = (id: string, change: Partial<PlanItem>) => update(items.map((i) => (i.id === id ? { ...i, ...change } : i)));
  const patchStation = (parentId: string, stationId: string, change: Partial<PlanItem>) =>
    update(items.map((i) => (i.id === parentId ? { ...i, children: i.children!.map((c) => (c.id === stationId ? { ...c, ...change } : c)) } : i)));
  const remove = (id: string) => update(items.filter((i) => i.id !== id));

  const setRotation = (item: PlanItem, rotate: number) => patch(item.id, withRotation(item, rotate));

  const usedIds = useMemo(() => new Set(items.flatMap((i) => [i.drillId, ...(i.children ?? []).map((c) => c.drillId)]).filter((x): x is string => !!x)), [items]);
  const total = totalMinutes(items);
  const offsets = startOffsets(items);
  const titles = displayTitles(items);
  const coaches = plan.input.coaches;
  const doc = planToDocModel({ title, date: plan.date, location, startTime: plan.startTime, durationMin: plan.durationMin, items, showTimes });

  /** Returns false when the save failed (the message says so). */
  const save = async (): Promise<boolean> => {
    setBusy("save");
    try {
      await savePlan(plan.id, { items, showTimes, title, location });
      setDirty(false);
      setMessage("Saved");
      return true;
    } catch {
      setMessage("Couldn't save the plan. Try again.");
      return false;
    } finally {
      setBusy("");
    }
  };
  const saveIfDirty = async () => !dirty || (await save());

  const regenerate = async () => {
    if (!confirm("Build a new plan from the same setup? Your edits to this plan will be replaced.")) return;
    setBusy("regen");
    try {
      const res = await regeneratePlan(plan.id);
      setItems(res.items);
      setWarnings(res.warnings);
      setDirty(false);
      setMessage("New plan generated");
    } catch {
      setMessage("Couldn't build a new plan. Try again.");
    } finally {
      setBusy("");
    }
  };

  // Open the tab during the click, before any await, so popup blockers allow it.
  const openAfterSave = async (url: string) => {
    const tab = window.open("about:blank", "_blank");
    if (!(await saveIfDirty())) {
      tab?.close();
      return;
    }
    if (tab) tab.location.href = url;
    else window.location.href = url;
  };

  const saveToDrive = async () => {
    setMessage("");
    const tab = window.open("about:blank", "_blank");
    try {
      if (!(await saveIfDirty())) {
        tab?.close();
        return;
      }
      setBusy("drive");
      const res = await fetch(`/api/plans/${plan.id}/drive`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.needsAuth) {
        tab?.close();
        signIn("google", { callbackUrl: window.location.href });
        return;
      }
      if (!res.ok) {
        tab?.close();
        setMessage(data.error ?? "Google Drive upload failed");
        return;
      }
      setMessage(data.folderFallback ? "Saved to My Drive (the app can't reach your plans folder, see Settings)" : data.updated ? "Updated the Google Doc" : "Saved to Google Drive");
      if (tab) tab.location.href = data.url;
      else window.open(data.url, "_blank");
    } catch {
      tab?.close();
      setMessage("Google Drive upload failed");
    } finally {
      setBusy("");
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((i) => i.id === e.active.id);
    const to = items.findIndex((i) => i.id === e.over!.id);
    update(arrayMove(items, from, to));
  };

  const openSwap = (item: PlanItem, onPick: (d: DrillLite) => void, isStation = false) =>
    setPicker({ types: compatibleTypes(item.blockType, isStation), currentId: item.drillId, onPick });

  const addDrillBlock = () =>
    setPicker({
      types: ["TEAM", "GAME", "TALK", "WARMUP", "THROWING", "DAILY", "SIDE_WORK"],
      onPick: (d) => insertBeforeNotes(drillToItem(d, newId())),
    });
  const insertBeforeNotes = (item: PlanItem) => {
    const at = items.findIndex((i) => i.kind === "notes");
    const next = [...items];
    next.splice(at === -1 ? next.length : at, 0, item);
    update(next);
  };

  const diff = total - plan.durationMin;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="space-y-3 print:hidden">
        <div className="card space-y-3">
          <input className="input text-base font-semibold" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} aria-label="Plan title" />
          <input className="input" value={location} onChange={(e) => { setLocation(e.target.value); setDirty(true); }} aria-label="Location" placeholder="Location" />
          <div className="flex flex-wrap items-center gap-2">
            <span data-testid="time-total" className={`rounded px-2 py-1 text-xs font-semibold ${diff === 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {total} / {plan.durationMin} min{diff !== 0 && ` (${diff > 0 ? "+" : ""}${diff})`}
            </span>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={showTimes} onChange={(e) => { setShowTimes(e.target.checked); setDirty(true); }} /> show times on plan
            </label>
            <div className="ml-auto flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={save} disabled={!!busy}>{busy === "save" ? "Saving…" : dirty ? "Save*" : "Save"}</button>
              <button className="btn" onClick={regenerate} disabled={!!busy}>{busy === "regen" ? "Building…" : "Regenerate"}</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <button className="btn" onClick={() => openAfterSave(`/plans/${plan.id}/print`)}>Print / PDF</button>
            <button className="btn" onClick={async () => { if (await saveIfDirty()) window.location.href = `/api/plans/${plan.id}/docx`; }}>Download .docx</button>
            <button className="btn" onClick={saveToDrive} disabled={!!busy}>{busy === "drive" ? "Saving to Drive…" : plan.driveFileId ? "Update Google Doc" : "Save to Google Drive"}</button>
            <Link className="btn" href={`/plans/new?from=${plan.id}`}>Use setup for next practice</Link>
            <button
              className="btn btn-danger ml-auto"
              onClick={async () => {
                if (!confirm("Delete this plan?")) return;
                await deletePlan(plan.id);
                router.push("/plans");
              }}
            >
              Delete
            </button>
          </div>
          {message && <p className="text-sm text-slate-600" role="status" data-testid="editor-message">{message}</p>}
          {warnings.length > 0 && (
            <ul className="space-y-1 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              {warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          )}
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((item, idx) => (
              <SortableCard key={item.id} id={item.id}>
                {(handle) => (
                  <div className={`card p-3 ${item.kind === "water" ? "bg-sky-50" : ""}`} data-testid="plan-item">
                    <div className="flex items-center gap-2">
                      {handle}
                      <span className="w-12 shrink-0 text-xs tabular-nums text-slate-500">{clockAt(plan.startTime, offsets[idx])}</span>
                      <input className="input font-semibold" value={item.kind === "circuit" ? titles[idx] : item.title} onChange={(e) => patch(item.id, { title: e.target.value })} aria-label="Block title" disabled={item.kind === "circuit" && item.title === "Circuit"} />
                      {item.kind !== "circuit" && (
                        <input type="number" min={0} className="input w-16" value={item.minutes} onChange={(e) => patch(item.id, { minutes: Number(e.target.value), children: item.children?.map((c) => ({ ...c, minutes: Number(e.target.value) })) })} aria-label="Minutes" />
                      )}
                      {item.kind !== "circuit" && <span className="text-xs text-slate-500">min</span>}
                      {item.drillId && item.kind === "block" && (
                        <button className="btn btn-sm" onClick={() => openSwap(item, (d) => { patch(item.id, swapDrill(item, d, drillById.get(item.drillId!))); setPicker(null); })}>Swap</button>
                      )}
                      <button className="btn btn-sm btn-danger" onClick={() => remove(item.id)} aria-label={`Remove ${item.title}`}>✕</button>
                    </div>

                    {item.kind === "circuit" && (
                      <div className="mt-2 flex items-center gap-2 pl-16 text-sm">
                        <span>Rotate every</span>
                        <input type="number" min={3} max={30} className="input w-16" value={item.rotateMinutes} onChange={(e) => setRotation(item, Number(e.target.value))} aria-label="Rotation minutes" />
                        <span>min · {item.minutes} min total</span>
                      </div>
                    )}

                    {item.kind !== "water" && (
                      <textarea
                        className="input mt-2 text-sm"
                        rows={Math.max(1, Math.min(6, item.lines.length))}
                        value={linesToText(item.lines)}
                        placeholder="Bullet points, one per line"
                        onChange={(e) => patch(item.id, { lines: e.target.value.split("\n") })}
                        onBlur={(e) => patch(item.id, { lines: textToLines(e.target.value) })}
                        aria-label="Bullet points"
                      />
                    )}

                    {item.groups && (
                      <div className="mt-2">
                        <span className="label">Groups</span>
                        <GroupsField key={item.groups.map(groupLine).join("\n")} groups={item.groups} onCommit={(groups) => patch(item.id, { groups })} />
                      </div>
                    )}

                    {item.children && (
                      <div className="mt-2 space-y-2 border-l-2 border-brand-100 pl-3">
                        {item.children.map((s, si) => (
                          <div key={s.id} className="rounded-md bg-slate-50 p-2" data-testid="station">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold text-slate-400">{String.fromCharCode(97 + si)}.</span>
                              <input className="input min-w-0 flex-1" value={s.title} onChange={(e) => patchStation(item.id, s.id, { title: e.target.value })} aria-label="Station title" />
                              <select className="input w-32" value={s.coach ?? ""} onChange={(e) => patchStation(item.id, s.id, { coach: e.target.value || undefined })} aria-label="Coach">
                                <option value="">No coach</option>
                                {[...new Set([...coaches, ...(s.coach ? [s.coach] : [])])].map((c) => (
                                  <option key={c} value={c}>Coach {c}</option>
                                ))}
                              </select>
                              <button className="btn btn-sm" onClick={() => openSwap(s, (d) => { patchStation(item.id, s.id, swapDrill(s, d, drillById.get(s.drillId ?? ""))); setPicker(null); }, true)}>Swap</button>
                              <button className="btn btn-sm" disabled={si === 0} onClick={() => { const c = arrayMove(item.children!, si, si - 1); patch(item.id, { children: c }); }} aria-label="Move up">↑</button>
                              <button
                                className="btn btn-sm btn-danger"
                                aria-label={`Remove station ${s.title}`}
                                onClick={() => {
                                  patch(item.id, withStations(item, item.children!.filter((c) => c.id !== s.id)));
                                }}
                              >
                                ✕
                              </button>
                            </div>
                            {s.who !== undefined && (
                              <input className="input mt-1 text-xs" value={s.who} onChange={(e) => patchStation(item.id, s.id, { who: e.target.value })} aria-label="Who" />
                            )}
                            <textarea
                              className="input mt-1 text-xs"
                              rows={Math.max(1, Math.min(4, s.lines.length))}
                              value={linesToText(s.lines)}
                              onChange={(e) => patchStation(item.id, s.id, { lines: e.target.value.split("\n") })}
                              onBlur={(e) => patchStation(item.id, s.id, { lines: textToLines(e.target.value) })}
                              aria-label="Station bullet points"
                            />
                          </div>
                        ))}
                        <button
                          className="btn btn-sm"
                          onClick={() =>
                            setPicker({
                              types: ["STATION", "SIDE_WORK"],
                              onPick: (d) => {
                                const rotate = item.rotateMinutes ?? item.minutes;
                                const st = drillToItem(d, newId(), { kind: "station", minutes: rotate, coach: coaches[item.children!.length] });
                                patch(item.id, withStations(item, [...item.children!, st]));
                                setPicker(null);
                              },
                            })
                          }
                        >
                          + Add station
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </SortableCard>
            ))}
          </SortableContext>
        </DndContext>

        <div className="card flex flex-wrap gap-2 p-3">
          <button className="btn" onClick={addDrillBlock}>+ Drill from library</button>
          <button
            className="btn"
            onClick={() =>
              insertBeforeNotes({
                id: newId(),
                kind: "circuit",
                title: "Circuit",
                minutes: 2,
                rotateMinutes: 8,
                lines: ["Split into even groups-rotate after 8 minutes"],
                groups: [],
                children: [],
              })
            }
          >
            + Circuit
          </button>
          <button className="btn" onClick={() => insertBeforeNotes({ id: newId(), kind: "water", title: "Water Break", minutes: 2, lines: [] })}>+ Water break</button>
          <button className="btn" onClick={() => insertBeforeNotes({ id: newId(), kind: "block", title: "New block", minutes: 10, lines: [] })}>+ Text block</button>
        </div>
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <div className="card max-h-[calc(100vh-2rem)] overflow-y-auto bg-white p-6">
          <PlanDocument doc={doc} />
        </div>
      </div>

      {picker && <DrillPicker drills={drills} plan={plan} types={picker.types} currentId={picker.currentId} usedIds={usedIds} onPick={picker.onPick} onClose={() => setPicker(null)} />}
    </div>
  );
}
