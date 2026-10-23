import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { googleConfigured } from "@/lib/auth";
import { getPlan, getSetting } from "@/lib/data";
import { prisma } from "@/lib/db";
import { planToDocModel } from "@/lib/export/docModel";
import { DriveError, saveGoogleDoc } from "@/lib/export/googleDrive";
import { docToHtml } from "@/lib/export/html";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!googleConfigured) {
    return Response.json({ error: "Google sign-in isn't set up yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see README)." }, { status: 400 });
  }
  const token = await getToken({ req });
  if (!token?.accessToken || token.error) return Response.json({ error: "Sign in with Google first.", needsAuth: true }, { status: 401 });

  const plan = await getPlan((await params).id);
  if (!plan) return Response.json({ error: "Plan not found" }, { status: 404 });

  try {
    const result = await saveGoogleDoc({
      accessToken: String(token.accessToken),
      name: plan.title,
      html: docToHtml(planToDocModel(plan)),
      folderId: await getSetting("driveFolderId"),
      existingFileId: plan.driveFileId || undefined,
    });
    await prisma.plan.update({ where: { id: plan.id }, data: { driveFileId: result.id } });
    return Response.json(result);
  } catch (e) {
    if (e instanceof DriveError && e.status === 401) return Response.json({ error: "Google sign-in expired. Sign in again.", needsAuth: true }, { status: 401 });
    return Response.json({ error: e instanceof Error ? e.message : "Drive upload failed" }, { status: 502 });
  }
}
