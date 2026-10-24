import { ReviewQueue, RoleToggle } from "@/components/ReviewQueue";
import { requireAdmin } from "@/lib/auth/session";
import { getPendingDrills, getSports } from "@/lib/data";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdmin();
  const [pending, sports, library, users] = await Promise.all([
    getPendingDrills(),
    getSports(user),
    prisma.drill.findMany({ where: { ownerId: null }, select: { name: true } }),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true, createdAt: true, _count: { select: { drills: true, plans: true, teams: true } } },
    }),
  ]);
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h1 className="h1">Drills to review</h1>
          <p className="text-sm text-slate-600">
            Coaches&apos; new drills are private to them until you approve them. Approving moves the drill into the shared library for everyone. Rejecting keeps it private to that coach.
          </p>
        </div>
        <ReviewQueue drills={pending} sports={sports} libraryNames={library.map((d) => d.name)} />
      </section>
      <section className="card space-y-2">
        <h2 className="h2">Coaches</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-1">Name</th>
              <th>Email</th>
              <th className="hidden md:table-cell">Teams · plans · private drills</th>
              <th>Role</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="py-1.5">{u.name}</td>
                <td className="break-all">{u.email}</td>
                <td className="hidden md:table-cell">{u._count.teams} · {u._count.plans} · {u._count.drills}</td>
                <td>{u.role === "ADMIN" ? "Admin" : "Coach"}</td>
                <td className="text-right"><RoleToggle userId={u.id} isAdmin={u.role === "ADMIN"} isMe={u.id === user.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
