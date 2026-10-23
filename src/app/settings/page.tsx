import { getServerSession } from "next-auth";
import { AddTagForm, CoachesForm, DefaultSportForm, DriveSettings, LocationsForm } from "@/components/SettingsForms";
import { authOptions, googleConfigured } from "@/lib/auth";
import { getSetting, getSports } from "@/lib/data";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [coaches, locations, sports, folderId, session] = await Promise.all([
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    getSports(),
    getSetting("driveFolderId"),
    googleConfigured ? getServerSession(authOptions) : null,
  ]);
  const surfaces = sports[0]?.tags.SURFACE.map((t) => ({ slug: t.slug, label: t.label })) ?? [];
  return (
    <div className="space-y-5">
      <h1 className="h1">Settings</h1>
      {sports.length > 1 && (
        <section className="card flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="h2">Default sport</h2>
            <p className="text-sm text-slate-600">Preselected on new plans, teams and the drill library.</p>
          </div>
          <DefaultSportForm sports={sports} />
        </section>
      )}
      <section className="card space-y-2">
        <h2 className="h2">Coaches</h2>
        <p className="text-sm text-slate-600">Saved coaches show up as quick picks on the plan form and get assigned to circuit stations.</p>
        <CoachesForm coaches={coaches} />
      </section>
      <section className="card space-y-2">
        <h2 className="h2">Locations</h2>
        <p className="text-sm text-slate-600">Picking a saved location on the plan form fills in its playing surface.</p>
        <LocationsForm locations={locations} surfaces={surfaces} />
      </section>
      <section className="card space-y-2">
        <h2 className="h2">Google Drive</h2>
        <p className="text-sm text-slate-600">“Save to Google Drive” creates a Google Doc in this folder, named like your existing plans.</p>
        <DriveSettings folderId={folderId} googleConfigured={googleConfigured} signedInAs={session?.user?.email} />
      </section>
      <section className="card space-y-2">
        <h2 className="h2">Tags</h2>
        <p className="text-sm text-slate-600">Add focus areas, equipment, surfaces or levels. New tags show up on the plan form and drill editor right away.</p>
        <AddTagForm sports={sports} />
      </section>
    </div>
  );
}
