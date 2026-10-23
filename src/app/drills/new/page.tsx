import { DrillForm } from "@/components/DrillForm";
import { getSports } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function NewDrillPage() {
  return (
    <div className="space-y-4">
      <h1 className="h1">Add drill</h1>
      <DrillForm sports={await getSports()} />
    </div>
  );
}
