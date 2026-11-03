import type { Prisma } from "@prisma/client";
import type { PlanItem } from "./types";

/** Every drill id in a plan's item tree, stations included, in order (with repeats). */
export function collectDrillIds(items: PlanItem[]): string[] {
  return items.flatMap((i) => [...(i.drillId ? [i.drillId] : []), ...collectDrillIds(i.children ?? [])]);
}

/** How many times each drill appears in a plan. */
export function drillCounts(items: PlanItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of collectDrillIds(items)) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/**
 * Rebuilds a plan's PlanDrill rows from its items. Call it in the same
 * transaction as the write to Plan.items. Drills deleted since the plan was
 * made are skipped.
 */
export async function syncPlanDrills(tx: Prisma.TransactionClient, planId: string, items: PlanItem[]) {
  const counts = drillCounts(items);
  await tx.planDrill.deleteMany({ where: { planId } });
  if (counts.size === 0) return;
  const existing = await tx.drill.findMany({ where: { id: { in: [...counts.keys()] } }, select: { id: true } });
  await tx.planDrill.createMany({ data: existing.map((d) => ({ planId, drillId: d.id, count: counts.get(d.id)! })) });
}
