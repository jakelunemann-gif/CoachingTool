import { notFound } from "next/navigation";
import { DrillForm } from "@/components/DrillForm";
import { getDrill, getSports } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function EditDrillPage({ params }: { params: Promise<{ id: string }> }) {
  const [drill, sports] = await Promise.all([getDrill((await params).id), getSports()]);
  if (!drill) notFound();
  return (
    <div className="space-y-4">
      <h1 className="h1">Edit drill</h1>
      <DrillForm drill={drill} sports={sports} />
    </div>
  );
}
