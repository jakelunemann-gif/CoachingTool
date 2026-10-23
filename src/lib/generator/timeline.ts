import type { PlanItem } from "../types";

export function totalMinutes(items: PlanItem[]): number {
  return items.reduce((sum, item) => sum + (item.minutes || 0), 0);
}

/** Minutes from practice start at which each top-level item begins. */
export function startOffsets(items: PlanItem[]): number[] {
  const offsets: number[] = [];
  let t = 0;
  for (const item of items) {
    offsets.push(t);
    t += item.minutes || 0;
  }
  return offsets;
}

/**
 * Display titles: a lone "Circuit" stays "Circuit", several become
 * "Circuit #1", "Circuit #2"... so numbering survives reordering.
 */
export function displayTitles(items: PlanItem[]): string[] {
  const circuitCount = items.filter((i) => i.kind === "circuit" && i.title === "Circuit").length;
  let n = 0;
  return items.map((item) => {
    if (item.kind === "circuit" && item.title === "Circuit" && circuitCount > 1) {
      n += 1;
      return `Circuit #${n}`;
    }
    return item.title;
  });
}
