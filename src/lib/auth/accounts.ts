import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "./password";

// Imported by the seed script too, so it takes the client as an argument and
// uses relative imports only.

export const MIN_PASSWORD_LENGTH = 8;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Emails in ADMIN_EMAILS (comma-separated) are admins as soon as they sign up. */
export function isAdminEmail(email: string): boolean {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean)
    .includes(normalizeEmail(email));
}

/**
 * Creates a coach account. The very first account is an admin and takes over
 * everything saved before accounts existed (teams, plans, coaches, locations
 * and the Drive folder), so upgrading an existing install loses nothing.
 */
export async function createAccount(prisma: PrismaClient, input: { email: string; name: string; password: string; admin?: boolean }) {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    const first = (await tx.user.count()) === 0;
    const legacy = first ? await tx.setting.findMany({ where: { key: { in: ["driveFolderId", "defaultSport"] } } }) : [];
    const legacyValue = (key: string) => legacy.find((s) => s.key === key)?.value ?? "";
    const user = await tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: first || input.admin || isAdminEmail(email) ? "ADMIN" : "COACH",
        driveFolderId: legacyValue("driveFolderId"),
        defaultSport: legacyValue("defaultSport"),
      },
    });
    if (first) {
      const claim = { where: { userId: null }, data: { userId: user.id } };
      await tx.team.updateMany(claim);
      await tx.plan.updateMany(claim);
      await tx.coach.updateMany(claim);
      await tx.location.updateMany(claim);
    }
    // The coach signing up is usually at practice, so they're a quick pick on the plan form.
    if (name) await tx.coach.upsert({ where: { userId_name: { userId: user.id, name } }, update: {}, create: { userId: user.id, name } });
    return user;
  });
}
