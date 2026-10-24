"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAccount, MIN_PASSWORD_LENGTH, normalizeEmail } from "@/lib/auth/accounts";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { endSession, requireAdmin, requireUser, startSession, type CurrentUser } from "@/lib/auth/session";
import { getDrills, getSport, getTeamHistory } from "@/lib/data";
import { prisma } from "@/lib/db";
import { planTitle } from "@/lib/format";
import { generatePlan } from "@/lib/generator";
import { randomSeed } from "@/lib/generator/random";
import { BLOCK_TYPES, TAG_KINDS, type PlanInput, type PlanItem } from "@/lib/types";

// --------------------------------------------------------------- Accounts

export interface AuthFormState {
  error?: string;
  // Echoed back so a failed submit doesn't clear what was typed.
  email?: string;
  name?: string;
}

// Only same-site paths, so a crafted ?next= can't send someone off-site.
const safeNext = (value: FormDataEntryValue | null) => {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
};

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Passwords need at least ${MIN_PASSWORD_LENGTH} characters`),
});

export async function signUp(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const typed = { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") };
  const parsed = signUpSchema.safeParse({ ...typed, password: form.get("password") });
  if (!parsed.success) return { ...typed, error: parsed.error.issues.map((i) => i.message).join("; ") };
  const code = process.env.SIGNUP_CODE;
  if (code && form.get("code") !== code) return { ...typed, error: "That sign-up code isn't right. Ask your admin for it." };
  if (await prisma.user.findUnique({ where: { email: normalizeEmail(parsed.data.email) } })) {
    return { ...typed, error: "An account with that email already exists. Log in instead." };
  }
  const user = await createAccount(prisma, parsed.data);
  await startSession(user.id);
  redirect(safeNext(form.get("next")));
}

// Compared against when the email is unknown, so both cases take as long.
let dummyHash: Promise<string> | undefined;

export async function logIn(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  dummyHash ??= hashPassword("not-a-real-password");
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
  if (!user || !ok) return { email, error: "Wrong email or password." };
  await startSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function logOut() {
  await endSession();
  redirect("/login");
}

export async function changePassword(current: string, next: string): Promise<{ error?: string }> {
  const me = await requireUser();
  if (next.length < MIN_PASSWORD_LENGTH) return { error: `Passwords need at least ${MIN_PASSWORD_LENGTH} characters` };
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(current, user.passwordHash))) return { error: "Your current password isn't right." };
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(next) } });
  return {};
}

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

async function runGenerator(user: CurrentUser, input: PlanInput, seed: number, excludePlanId?: string) {
  const sport = await getSport(input.sportSlug);
  if (!sport) throw new Error(`Unknown sport ${input.sportSlug}`);
  const [drills, history] = await Promise.all([getDrills(user.id, sport.slug), getTeamHistory(input.teamId, excludePlanId)]);
  const focusLabels = Object.fromEntries(sport.tags.FOCUS.map((t) => [t.slug, t.label]));
  return { sport, plan: generatePlan(input, drills, { seed, sportConfig: sport.config, focusLabels, ...history }) };
}

export async function createPlan(raw: PlanInput): Promise<{ id?: string; error?: string }> {
  const user = await requireUser();
  const parsed = planInputSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const input = parsed.data as PlanInput;
  // A plan copied from an older one can reference a team deleted since; drop it rather than fail the insert.
  if (input.teamId && !(await prisma.team.findFirst({ where: { id: input.teamId, userId: user.id }, select: { id: true } }))) {
    input.teamId = undefined;
  }
  const seed = randomSeed();
  const { sport, plan } = await runGenerator(user, input, seed);
  const created = await prisma.plan.create({
    data: {
      userId: user.id,
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
  const user = await requireUser();
  const existing = await prisma.plan.findUniqueOrThrow({ where: { id, userId: user.id } });
  const seed = randomSeed();
  const { plan } = await runGenerator(user, existing.input as unknown as PlanInput, seed, id);
  await prisma.plan.update({
    where: { id },
    data: { seed, items: plan.items as object[], warnings: plan.warnings, teamLeader: plan.teamLeader },
  });
  return { items: plan.items, warnings: plan.warnings, teamLeader: plan.teamLeader };
}

export async function savePlan(id: string, data: { items: PlanItem[]; showTimes: boolean; title: string; location: string }) {
  const user = await requireUser();
  await prisma.plan.update({
    where: { id, userId: user.id },
    data: { items: data.items as object[], showTimes: data.showTimes, title: data.title.trim() || "Practice Plan", location: data.location },
  });
  revalidatePath(`/plans/${id}`);
  revalidatePath("/plans");
  return { savedAt: new Date().toISOString() };
}

export async function deletePlan(id: string) {
  const user = await requireUser();
  await prisma.plan.delete({ where: { id, userId: user.id } });
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
  // Admins only: put a new drill straight into the shared library.
  addToLibrary: z.boolean().optional(),
});
export type DrillFormValues = z.infer<typeof drillSchema>;

// Coaches can change their own drills; admins can change any drill.
async function findEditableDrill(id: string, user: CurrentUser) {
  return prisma.drill.findFirst({ where: { id, ...(user.isAdmin ? {} : { ownerId: user.id }) } });
}

function revalidateDrills() {
  revalidatePath("/drills");
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}

export async function saveDrill(raw: DrillFormValues): Promise<{ id?: string; error?: string }> {
  const user = await requireUser();
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
  if (v.id && !(await findEditableDrill(v.id, user))) return { error: "You can only edit your own drills." };
  // A coach's new drill is private to them and waits in the admin review queue.
  const toLibrary = user.isAdmin && v.addToLibrary;
  const drill = v.id
    ? await prisma.drill.update({
        where: { id: v.id },
        data: { ...data, sports: { set: sports }, tags: { set: v.tagIds.map((id) => ({ id })) }, videos: { deleteMany: {}, create: videos } },
      })
    : await prisma.drill.create({
        data: {
          ...data,
          ownerId: toLibrary ? null : user.id,
          submittedById: user.id,
          reviewStatus: toLibrary ? "" : "PENDING",
          sports: { connect: sports },
          tags: { connect: v.tagIds.map((id) => ({ id })) },
          videos: { create: videos },
        },
      });
  revalidateDrills();
  return { id: drill.id };
}

export async function deleteDrill(id: string) {
  const user = await requireUser();
  if (!(await findEditableDrill(id, user))) throw new Error("You can only delete your own drills.");
  await prisma.drill.delete({ where: { id } });
  revalidateDrills();
}

/** Puts a rejected drill back in the review queue after the coach has updated it. */
export async function resubmitDrill(id: string) {
  const user = await requireUser();
  await prisma.drill.updateMany({ where: { id, ownerId: user.id, reviewStatus: "REJECTED" }, data: { reviewStatus: "PENDING" } });
  revalidateDrills();
}

// ----------------------------------------------------------------- Review

/** Moves a submitted drill into the shared library for every coach. */
export async function approveDrill(id: string) {
  await requireAdmin();
  await prisma.drill.update({
    where: { id, reviewStatus: "PENDING" },
    data: { ownerId: null, reviewStatus: "APPROVED", reviewNote: "", reviewedAt: new Date() },
  });
  revalidateDrills();
}

/** Keeps the drill private to its coach and tells them why. */
export async function rejectDrill(id: string, note: string) {
  await requireAdmin();
  await prisma.drill.update({
    where: { id, reviewStatus: "PENDING" },
    data: { reviewStatus: "REJECTED", reviewNote: note.trim(), reviewedAt: new Date() },
  });
  revalidateDrills();
}

export async function setUserRole(userId: string, role: "ADMIN" | "COACH") {
  const me = await requireAdmin();
  if (userId === me.id) throw new Error("You can't change your own role.");
  await prisma.user.update({ where: { id: userId }, data: { role: z.enum(["ADMIN", "COACH"]).parse(role) } });
  revalidatePath("/admin");
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
  const user = await requireUser();
  const parsed = teamSchema.safeParse({ ...raw, players: raw.players.filter((p) => p.name.trim()) });
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  const v = parsed.data;
  const sport = await prisma.sport.findUniqueOrThrow({ where: { slug: v.sportSlug } });
  const base = { name: v.name, sportId: sport.id, ageSlug: v.ageSlug, skillSlug: v.skillSlug, season: v.season };
  const team = await prisma.$transaction(async (tx) => {
    const t = v.id
      ? await tx.team.update({ where: { id: v.id, userId: user.id }, data: base })
      : await tx.team.create({ data: { ...base, userId: user.id } });
    const keep = v.players.filter((p) => p.id).map((p) => p.id!);
    await tx.player.deleteMany({ where: { teamId: t.id, id: { notIn: keep } } });
    for (const [i, p] of v.players.entries()) {
      const data = { name: p.name, roles: p.roles, active: p.active, sortOrder: i };
      if (p.id) await tx.player.update({ where: { id: p.id, teamId: t.id }, data });
      else await tx.player.create({ data: { ...data, teamId: t.id } });
    }
    return t;
  });
  revalidatePath("/teams");
  return { id: team.id };
}

export async function deleteTeam(id: string) {
  const user = await requireUser();
  await prisma.team.delete({ where: { id, userId: user.id } });
  revalidatePath("/teams");
}

// --------------------------------------------------------------- Settings

export async function addCoach(name: string) {
  const user = await requireUser();
  const n = name.trim();
  if (n) {
    await prisma.coach.upsert({ where: { userId_name: { userId: user.id, name: n } }, update: { active: true }, create: { userId: user.id, name: n } });
  }
  revalidatePath("/settings");
}

export async function removeCoach(id: string) {
  const user = await requireUser();
  await prisma.coach.delete({ where: { id, userId: user.id } });
  revalidatePath("/settings");
}

export async function addLocation(name: string, surfaceSlug: string) {
  const user = await requireUser();
  const n = name.trim();
  if (n) {
    await prisma.location.upsert({
      where: { userId_name: { userId: user.id, name: n } },
      update: { surfaceSlug },
      create: { userId: user.id, name: n, surfaceSlug },
    });
  }
  revalidatePath("/settings");
}

export async function removeLocation(id: string) {
  const user = await requireUser();
  await prisma.location.delete({ where: { id, userId: user.id } });
  revalidatePath("/settings");
}

/** Per-coach preferences shown on the Settings page. */
export async function setUserPreference(key: "defaultSport" | "driveFolderId", value: string) {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { [z.enum(["defaultSport", "driveFolderId"]).parse(key)]: value } });
  revalidatePath("/settings");
}

export async function addTag(kind: string, label: string, sportSlug: string) {
  // Tags are shared by every coach, so only admins add them.
  await requireAdmin();
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
