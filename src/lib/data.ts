import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { BlockType, DrillLite, PlanInput, PlanItem, ReviewStatus, SportBundle, SportConfig, TagKind, TeamWithPlayers } from "./types";

const drillInclude = {
  sports: true,
  tags: true,
  videos: { orderBy: { sortOrder: "asc" } },
  submittedBy: { select: { name: true } },
} satisfies Prisma.DrillInclude;
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
    ownerId: d.ownerId,
    reviewStatus: d.reviewStatus as ReviewStatus,
    reviewNote: d.reviewNote,
    submittedBy: d.submittedBy?.name ?? "",
  };
}

/** Library drills plus the user's own private drills. */
export async function getDrills(userId: string, sportSlug?: string): Promise<DrillLite[]> {
  const rows = await prisma.drill.findMany({
    where: { OR: [{ ownerId: null }, { ownerId: userId }], ...(sportSlug ? { sports: { some: { slug: sportSlug } } } : {}) },
    include: drillInclude,
    orderBy: { name: "asc" },
  });
  return rows.map(toDrillLite);
}

/** Matches a drill the user may edit: their own, or any drill for admins. */
export function editableDrillWhere(id: string, user: { id: string; isAdmin: boolean }): Prisma.DrillWhereInput {
  return { id, ...(user.isAdmin ? {} : { ownerId: user.id }) };
}

export async function getEditableDrill(id: string, user: { id: string; isAdmin: boolean }): Promise<DrillLite | null> {
  const row = await prisma.drill.findFirst({ where: editableDrillWhere(id, user), include: drillInclude });
  return row ? toDrillLite(row) : null;
}

/** Drills waiting for an admin, oldest first. */
export async function getPendingDrills(): Promise<DrillLite[]> {
  const rows = await prisma.drill.findMany({ where: { reviewStatus: "PENDING" }, include: drillInclude, orderBy: { createdAt: "asc" } });
  return rows.map(toDrillLite);
}

/** Sports with their tags. The user's default sport (or the site default) is listed first. */
export async function getSports(user?: { defaultSport: string }): Promise<SportBundle[]> {
  const [sports, tags, siteDefault] = await Promise.all([
    prisma.sport.findMany({ orderBy: { name: "asc" } }),
    prisma.tag.findMany({ orderBy: { sortOrder: "asc" } }),
    getSetting("defaultSport"),
  ]);
  const defaultSport = user?.defaultSport || siteDefault;
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

export async function getPlan(id: string, userId: string): Promise<PlanRecord | null> {
  const p = await prisma.plan.findFirst({ where: { id, userId }, include: { sport: true } });
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

export async function getTeams(userId: string): Promise<TeamWithPlayers[]> {
  const teams = await prisma.team.findMany({
    where: { userId },
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
