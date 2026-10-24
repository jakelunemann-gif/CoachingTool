import { DrillForm } from "@/components/DrillForm";
import { requireUser } from "@/lib/auth/session";
import { getSports } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function NewDrillPage() {
  const user = await requireUser();
  return (
    <div className="space-y-4">
      <h1 className="h1">Add drill</h1>
      <p className="text-sm text-slate-600">
        {user.isAdmin
          ? "Drills you add go straight into the shared library unless you keep them private."
          : "New drills are private to you right away, and an admin reviews them for the shared library."}
      </p>
      <DrillForm sports={await getSports(user)} canAddToLibrary={user.isAdmin} />
    </div>
  );
}
