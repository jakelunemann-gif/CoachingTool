import type { BlockType, DrillLite, PlanInput } from "../types";

export interface FilterContext {
  sportSlug: string;
  ageSlug: string;
  skillSlug: string;
  surfaceSlug: string;
  equipment: Set<string>;
  coaches: number;
  players: number;
}

export function contextFromInput(input: PlanInput): FilterContext {
  return {
    sportSlug: input.sportSlug,
    ageSlug: input.ageSlug,
    skillSlug: input.skillSlug,
    surfaceSlug: input.surfaceSlug,
    equipment: new Set(input.equipmentSlugs),
    coaches: Math.max(1, input.coaches.length),
    players: playerCount(input),
  };
}

export function playerCount(input: PlanInput): number {
  return input.players.length > 0 ? input.players.length : Math.max(0, input.playerCount || 0);
}

/** Why a drill can't be used in this practice, or null if it can. */
export function rejectReason(drill: DrillLite, ctx: FilterContext): string | null {
  if (!drill.sports.includes(ctx.sportSlug)) return "different sport";
  if (drill.ages.length > 0 && ctx.ageSlug && !drill.ages.includes(ctx.ageSlug)) return "not tagged for this age";
  if (drill.skills.length > 0 && ctx.skillSlug && !drill.skills.includes(ctx.skillSlug)) return "not tagged for this level";
  if (drill.surfaces.length > 0 && ctx.surfaceSlug && !drill.surfaces.includes(ctx.surfaceSlug)) return "needs a different surface";
  const missing = drill.equipment.filter((e) => !ctx.equipment.has(e));
  if (missing.length > 0) return `needs ${missing.join(", ")}`;
  if (drill.coachesRequired > ctx.coaches) return `needs ${drill.coachesRequired} coaches`;
  if (drill.minPlayers > ctx.players) return `needs ${drill.minPlayers}+ players`;
  return null;
}

export function isEligible(drill: DrillLite, ctx: FilterContext): boolean {
  return rejectReason(drill, ctx) === null;
}

// Which drill types can stand in for each other when swapping in the editor.
const COMPATIBLE: Record<BlockType, BlockType[]> = {
  WARMUP: ["WARMUP"],
  THROWING: ["THROWING", "DAILY"],
  DAILY: ["DAILY", "THROWING"],
  STATION: ["STATION", "SIDE_WORK"],
  SIDE_WORK: ["SIDE_WORK", "STATION"],
  TEAM: ["TEAM", "GAME", "TALK"],
  GAME: ["GAME", "TEAM"],
  TALK: ["TALK", "TEAM"],
};

export function compatibleTypes(blockType: BlockType | undefined, isStation: boolean): BlockType[] {
  if (isStation) return COMPATIBLE.STATION;
  return blockType ? COMPATIBLE[blockType] : ["TEAM", "GAME", "TALK"];
}

/**
 * Drills that could replace `currentDrillId`, eligible ones first, ordered
 * by how many of the selected focus areas they cover.
 */
export function alternatives(
  drills: DrillLite[],
  input: PlanInput,
  types: BlockType[],
  currentDrillId?: string,
): { drill: DrillLite; reason: string | null }[] {
  const ctx = contextFromInput(input);
  const focus = new Set(input.focusSlugs);
  return drills
    .filter((d) => d.id !== currentDrillId && d.sports.includes(input.sportSlug) && types.includes(d.blockType))
    .map((drill) => ({ drill, reason: rejectReason(drill, ctx), match: drill.focus.filter((f) => focus.has(f)).length }))
    .sort((a, b) => Number(a.reason !== null) - Number(b.reason !== null) || b.match - a.match || a.drill.name.localeCompare(b.drill.name))
    .map(({ drill, reason }) => ({ drill, reason }));
}
