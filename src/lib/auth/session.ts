import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "../db";
import { SESSION_COOKIE } from "./cookie";

const SESSION_DAYS = 30;

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  defaultSport: string;
  driveFolderId: string;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Secure cookies need https, except on localhost where browsers allow them anyway.
const secureCookies = () => (process.env.NEXTAUTH_URL ?? "").startsWith("https://");

/** Starts a session for the user. Call from a server action or route handler. */
export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.userSession.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  // Old sessions are cleaned up here rather than on a schedule.
  await prisma.userSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: secureCookies(), path: "/", expires: expiresAt });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.userSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.userSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  const u = session.user;
  return { id: u.id, email: u.email, name: u.name, isAdmin: u.role === "ADMIN", defaultSport: u.defaultSport, driveFolderId: u.driveFolderId };
});

/** The signed-in user; sends anyone else to the login page. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}
