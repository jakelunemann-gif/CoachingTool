import { notFound } from "next/navigation";
import { PlanEditor } from "@/components/PlanEditor";
import { requireUser } from "@/lib/auth/session";
import { getDrills, getPlan } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const plan = await getPlan((await params).id, user.id);
  if (!plan) notFound();
  const drills = await getDrills(user.id, plan.sportSlug);
  return <PlanEditor plan={plan} drills={drills} />;
}
