"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDrills, getSport, getTeamHistory } from "@/lib/data";
import { prisma } from "@/lib/db";
import { planTitle } from "@/lib/format";
import { generatePlan } from "@/lib/generator";
import { randomSeed } from "@/lib/generator/random";
import { BLOCK_TYPES, TAG_KINDS, type PlanInput, type PlanItem } from "@/lib/types";

// ------------------------------------------------------------------ Plans

const planInputSchema = z.object({
  sportSlug: z.string().min(1),
  teamId: z.string().optional(),
  teamName: z.string().default(""),
  ageSlug: z.string().default(""),
  skillSlug: z.string().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Pick a start time"),
  durationMin: z.number().int().min(15).max(300),
  location: z.string().default(""),
  surfaceSlug: z.string().default(""),
  equipmentSlugs: z.array(z.string()),
  focusSlugs: z.array(z.string()),
  coaches: z.array(z.string()),
  players: z.array(z.object({ id: z.string().optional(), name: z.string(), roles: z.array(z.string()) })),
  missing: z.array(z.string()),
  playerCount: z.number().int().min(0).max(100),
  options: z.object({ intro: z.boolean(), dailies: z.boolean(), sideWork: z.boolean(), endGame: z.boolean() }),
  notes: z.string().default(""),
});

async function runGenerator(input: PlanInput, seed: number, excludePlanId?: string) {
  const sport = await getSport(input.sportSlug);
  if (!sport) throw new Error(`Unknown sport ${input.sportSlug}`);
  const [drills, history] = await Promise.all([getDrills(sport.slug), getTeamHistory(input.teamId, excludePlanId)]);
  const focusLabels = Object.fromEntries(sport.tags.FOCUS.map((t) => [t.slug, t.label]));
  return { sport, plan: generatePlan(input, drills, { seed, sportConfig: sport.config, focusLabels, ...history }) };
}

export async function createPlan(raw: PlanInput): Promise<{ id?: string; error?: string }> {
  const parsed = planInputSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const input = parsed.data as PlanInput;
  // A plan copied from an older one can reference a team deleted since; drop it rather than fail the insert.
  if (input.teamId && !(await prisma.team.findUnique({ where: { id: input.teamId }, select: { id: true } }))) {
    input.teamId = undefined;
  }
  const seed = randomSeed();
  const { sport, plan } = await runGenerator(input, seed);
  const created = await prisma.plan.create({
    data: {
      title: planTitle(input.date, input.teamName, sport.name),
      sportId: sport.id,
      teamId: input.teamId || null,
      date: input.date,
      startTime: input.startTime,
      durationMin: input.durationMin,
      location: input.location,
      teamLeader: plan.teamLeader,
      seed,
      input: input as object,
      items: plan.items as object[],
      warnings: plan.warnings,
    },
  });
  revalidatePath("/plans");
  return { id: created.id };
}

export async function regeneratePlan(id: string): Promise<{ items: PlanItem[]; warnings: string[]; teamLeader: string }> {
  const existing = await prisma.plan.findUniqueOrThrow({ where: { id } });
  const seed = randomSeed();
  const { plan } = await runGenerator(existing.input as unknown as PlanInput, seed, id);
  await prisma.plan.update({
    where: { id },
    data: { seed, items: plan.items as object[], warnings: plan.warnings, teamLeader: plan.teamLeader },
  });
  return { items: plan.items, warnings: plan.warnings, teamLeader: plan.teamLeader };
}

export async function savePlan(id: string, data: { items: PlanItem[]; showTimes: boolean; title: string; location: string }) {
  await prisma.plan.update({
    where: { id },
    data: { items: data.items as object[], showTimes: data.showTimes, title: data.title.trim() || "Practice Plan", location: data.location },
  });
  revalidatePath(`/plans/${id}`);
  revalidatePath("/plans");
  return { savedAt: new Date().toISOString() };
}

export async function deletePlan(id: string) {
  await prisma.plan.delete({ where: { id } });
  revalidatePath("/plans");
  revalidatePath("/");
}

// ----------------------------------------------------------------- Drills

const drillSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required"),
  blockType: z.enum(BLOCK_TYPES),
  description: z.string(),
  instructions: z.string(),
  durationMin: z.number().int().min(1).max(120),
  durationTypical: z.number().int().min(1).max(120),
  durationMax: z.number().int().min(1).max(180),
  coachesRequired: z.number().int().min(0).max(10),
  minPlayers: z.number().int().min(1).max(50),
  maxPlayers: z.number().int().min(1).max(100).nullable(),
  source: z.string(),
  sportSlugs: z.array(z.string()).min(1, "Pick at least one sport"),
  tagIds: z.array(z.string()),
  videos: z.array(z.object({ url: z.string().trim().url("Video links must be full URLs"), label: z.string() })),
});
export type DrillFormValues = z.infer<typeof drillSchema>;

export async function saveDrill(raw: DrillFormValues): Promise<{ id?: string; error?: string }> {
  const parsed = drillSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const v = parsed.data;
  if (!(v.durationMin <= v.durationTypical && v.durationTypical <= v.durationMax)) {
    return { error: "Durations must be min ≤ typical ≤ max" };
  }
  const sports = await prisma.sport.findMany({ where: { slug: { in: v.sportSlugs } }, select: { id: true } });
  const data = {
    name: v.name,
    blockType: v.blockType,
    description: v.description,
    instructions: v.instructions,
    durationMin: v.durationMin,
    durationTypical: v.durationTypical,
    durationMax: v.durationMax,
    coachesRequired: v.coachesRequired,
    minPlayers: v.minPlayers,
    maxPlayers: v.maxPlayers,
    source: v.source,
  };
  const videos = v.videos.filter((x) => x.url).map((x, i) => ({ url: x.url, label: x.label, sortOrder: i }));
  const drill = v.id
    ? await prisma.drill.update({
        where: { id: v.id },
        data: { ...data, sports: { set: sports }, tags: { set: v.tagIds.map((id) => ({ id })) }, videos: { deleteMany: {}, create: videos } },
      })
    : await prisma.drill.create({
        data: { ...data, sports: { connect: sports }, tags: { connect: v.tagIds.map((id) => ({ id })) }, videos: { create: videos } },
      });
  revalidatePath("/drills");
  return { id: drill.id };
}

export async function deleteDrill(id: string) {
  await prisma.drill.delete({ where: { id } });
  revalidatePath("/drills");
}

// ------------------------------------------------------------------ Teams

const teamSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Team name is required"),
  sportSlug: z.string().min(1),
  ageSlug: z.string(),
  skillSlug: z.string(),
  season: z.string(),
  players: z.array(z.object({ id: z.string().optional(), name: z.string().trim().min(1), roles: z.array(z.string()), active: z.boolean() })),
});
export type TeamFormValues = z.infer<typeof teamSchema>;

export async function saveTeam(raw: TeamFormValues): Promise<{ id?: string; error?: string }> {
  const parsed = teamSchema.safeParse({ ...raw, players: raw.players.filter((p) => p.name.trim()) });
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const v = parsed.data;
  const sport = await prisma.sport.findUniqueOrThrow({ where: { slug: v.sportSlug } });
  const base = { name: v.name, sportId: sport.id, ageSlug: v.ageSlug, skillSlug: v.skillSlug, season: v.season };
  const team = await prisma.$transaction(async (tx) => {
    const t = v.id ? await tx.team.update({ where: { id: v.id }, data: base }) : await tx.team.create({ data: base });
    const keep = v.players.filter((p) => p.id).map((p) => p.id!);
    await tx.player.deleteMany({ where: { teamId: t.id, id: { notIn: keep } } });
    for (const [i, p] of v.players.entries()) {
      const data = { name: p.name, roles: p.roles, active: p.active, sortOrder: i };
      if (p.id) await tx.player.update({ where: { id: p.id }, data });
      else await tx.player.create({ data: { ...data, teamId: t.id } });
    }
    return t;
  });
  revalidatePath("/teams");
  return { id: team.id };
}

export async function deleteTeam(id: string) {
  await prisma.team.delete({ where: { id } });
  revalidatePath("/teams");
}

// --------------------------------------------------------------- Settings

export async function addCoach(name: string) {
  const n = name.trim();
  if (n) await prisma.coach.upsert({ where: { name: n }, update: { active: true }, create: { name: n } });
  revalidatePath("/settings");
}

export async function removeCoach(id: string) {
  await prisma.coach.delete({ where: { id } });
  revalidatePath("/settings");
}

export async function addLocation(name: string, surfaceSlug: string) {
  const n = name.trim();
  if (n) await prisma.location.upsert({ where: { name: n }, update: { surfaceSlug }, create: { name: n, surfaceSlug } });
  revalidatePath("/settings");
}

export async function removeLocation(id: string) {
  await prisma.location.delete({ where: { id } });
  revalidatePath("/settings");
}

export async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  revalidatePath("/settings");
}

export async function addTag(kind: string, label: string, sportSlug: string) {
  const parsedKind = z.enum(TAG_KINDS).parse(kind);
  const sport = await prisma.sport.findUniqueOrThrow({ where: { slug: sportSlug } });
  const slug = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) return;
  const group = parsedKind === "AGE" || parsedKind === "SKILL" || parsedKind === "SURFACE" ? "global" : sport.tagGroup;
  await prisma.tag.upsert({
    where: { kind_slug_group: { kind: parsedKind, slug, group } },
    update: {},
    create: { kind: parsedKind, slug, label: label.trim(), group, sortOrder: 1000 },
  });
  revalidatePath("/settings");
}
