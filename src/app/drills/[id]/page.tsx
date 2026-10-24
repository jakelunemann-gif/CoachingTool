import { notFound } from "next/navigation";
import { DrillForm } from "@/components/DrillForm";
import { requireUser } from "@/lib/auth/session";
import { getEditableDrill, getSports } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function EditDrillPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const user = await requireUser();
  const [drill, sports] = await Promise.all([getEditableDrill((await params).id, user), getSports(user)]);
  if (!drill) notFound();
  const fromReview = (await searchParams).from === "review";
  return (
    <div className="space-y-4">
      <h1 className="h1">Edit drill</h1>
      {drill.ownerId && drill.ownerId !== user.id && (
        <p className="text-sm text-slate-600">Submitted by {drill.submittedBy || "a coach"}. Your changes are saved before you approve or reject it.</p>
      )}
      <DrillForm drill={drill} sports={sports} returnTo={fromReview ? "/admin" : "/drills"} />
    </div>
  );
}
