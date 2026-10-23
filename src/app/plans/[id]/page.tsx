import { notFound } from "next/navigation";
import { PlanEditor } from "@/components/PlanEditor";
import { getDrills, getPlan } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const plan = await getPlan((await params).id);
  if (!plan) notFound();
  const drills = await getDrills(plan.sportSlug);
  return <PlanEditor plan={plan} drills={drills} />;
}
