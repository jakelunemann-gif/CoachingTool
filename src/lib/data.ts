import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { BlockType, DrillLite, PlanInput, PlanItem, SportBundle, SportConfig, TagKind, TeamWithPlayers } from "./types";

const drillInclude = { sports: true, tags: true, videos: { orderBy: { sortOrder: "asc" } } } satisfies Prisma.DrillInclude;
type DrillRow = Prisma.DrillGetPayload<{ include: typeof drillInclude }>;

export function toDrillLite(d: DrillRow): DrillLite {
  const slugs = (kind: TagKind) => d.tags.filter((t) => t.kind === kind).map((t) => t.slug);
  return {
    id: d.id,
    name: d.name,
    blockType: d.blockType as BlockType,
    description: d.description,
    instructions: d.instructions.split("\n").map((l) => l.trim()).filter(Boolean),
    durationMin: d.durationMin,
    durationTypical: d.durationTypical,
    durationMax: d.durationMax,
    coachesRequired: d.coachesRequired,
    minPlayers: d.minPlayers,
    maxPlayers: d.maxPlayers,
    source: d.source,
    sports: d.sports.map((s) => s.slug),
    ages: slugs("AGE"),
    skills: slugs("SKILL"),
    focus: slugs("FOCUS"),
    surfaces: slugs("SURFACE"),
    equipment: slugs("EQUIPMENT"),
    videos: d.videos.map((v) => ({ url: v.url, label: v.label })),
  };
}

export async function getDrills(sportSlug?: string): Promise<DrillLite[]> {
  const rows = await prisma.drill.findMany({
    where: sportSlug ? { sports: { some: { slug: sportSlug } } } : undefined,
    include: drillInclude,
    orderBy: { name: "asc" },
  });
  return rows.map(toDrillLite);
}

export async function getDrill(id: string): Promise<DrillLite | null> {
  const row = await prisma.drill.findUnique({ where: { id }, include: drillInclude });
  return row ? toDrillLite(row) : null;
}

export async function getSports(): Promise<SportBundle[]> {
  const [sports, tags, defaultSport] = await Promise.all([
    prisma.sport.findMany({ orderBy: { name: "asc" } }),
    prisma.tag.findMany({ orderBy: { sortOrder: "asc" } }),
    getSetting("defaultSport"),
  ]);
  // The default sport is listed first so forms preselect it.
  sports.sort((a, b) => Number(b.slug === defaultSport) - Number(a.slug === defaultSport));
  return sports.map((s) => {
    const mine = tags.filter((t) => t.group === "global" || t.group === s.tagGroup);
    const byKind = (kind: TagKind) =>
      mine.filter((t) => t.kind === kind).map((t) => ({ id: t.id, kind, slug: t.slug, label: t.label, sortOrder: t.sortOrder }));
    return {
      id: s.id,
      slug: s.slug,
      name: s.name,
      config: s.config as unknown as SportConfig,
      tags: { AGE: byKind("AGE"), SKILL: byKind("SKILL"), FOCUS: byKind("FOCUS"), SURFACE: byKind("SURFACE"), EQUIPMENT: byKind("EQUIPMENT") },
    };
  });
}

export async function getSport(slug: string): Promise<SportBundle | undefined> {
  return (await getSports()).find((s) => s.slug === slug);
}

export async function getSetting(key: string): Promise<string> {
  return (await prisma.setting.findUnique({ where: { key } }))?.value ?? "";
}

export interface PlanRecord {
  id: string;
  title: string;
  sportSlug: string;
  sportName: string;
  teamId: string | null;
  date: string;
  startTime: string;
  durationMin: number;
  location: string;
  teamLeader: string;
  seed: number;
  input: PlanInput;
  items: PlanItem[];
  showTimes: boolean;
  warnings: string[];
  driveFileId: string;
  updatedAt: string;
}

export async function getPlan(id: string): Promise<PlanRecord | null> {
  const p = await prisma.plan.findUnique({ where: { id }, include: { sport: true } });
  if (!p) return null;
  return {
    id: p.id,
    title: p.title,
    sportSlug: p.sport.slug,
    sportName: p.sport.name,
    teamId: p.teamId,
    date: p.date,
    startTime: p.startTime,
    durationMin: p.durationMin,
    location: p.location,
    teamLeader: p.teamLeader,
    seed: p.seed,
    input: p.input as unknown as PlanInput,
    items: p.items as unknown as PlanItem[],
    showTimes: p.showTimes,
    warnings: p.warnings as unknown as string[],
    driveFileId: p.driveFileId,
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Drill ids and team leaders from a team's most recent plans. */
export async function getTeamHistory(teamId: string | undefined, excludePlanId?: string, limit = 3) {
  if (!teamId) return { recentDrillIds: [], recentLeaders: [] };
  const plans = await prisma.plan.findMany({
    where: { teamId, id: excludePlanId ? { not: excludePlanId } : undefined },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 12,
    select: { items: true, teamLeader: true },
  });
  const ids: string[] = [];
  const collect = (items: PlanItem[]) =>
    items.forEach((i) => {
      if (i.drillId) ids.push(i.drillId);
      if (i.children) collect(i.children);
    });
  plans.slice(0, limit).forEach((p) => collect(p.items as unknown as PlanItem[]));
  return { recentDrillIds: ids, recentLeaders: plans.map((p) => p.teamLeader).filter(Boolean) };
}

export async function getTeams(): Promise<TeamWithPlayers[]> {
  const teams = await prisma.team.findMany({
    include: { sport: true, players: { orderBy: { sortOrder: "asc" } } },
    orderBy: { name: "asc" },
  });
  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    sportSlug: t.sport.slug,
    ageSlug: t.ageSlug,
    skillSlug: t.skillSlug,
    season: t.season,
    players: t.players.map((p) => ({ id: p.id, name: p.name, roles: p.roles as string[], active: p.active })),
  }));
}
