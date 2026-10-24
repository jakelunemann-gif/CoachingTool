import Link from "next/link";
import { DrillLibrary } from "@/components/DrillLibrary";
import { requireUser } from "@/lib/auth/session";
import { getDrills, getSports } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function DrillsPage() {
  const user = await requireUser();
  const [drills, sports] = await Promise.all([getDrills(user.id), getSports(user)]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Drill library</h1>
        <Link href="/drills/new" className="btn btn-primary">Add drill</Link>
      </div>
      <DrillLibrary drills={drills} sports={sports} isAdmin={user.isAdmin} />
    </div>
  );
}
