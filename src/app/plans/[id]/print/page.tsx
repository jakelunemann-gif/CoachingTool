import { notFound } from "next/navigation";
import { PlanDocument } from "@/components/PlanDocument";
import { PrintButton } from "@/components/PrintButton";
import { getPlan } from "@/lib/data";
import { planToDocModel } from "@/lib/export/docModel";

export const dynamic = "force-dynamic";

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const plan = await getPlan((await params).id);
  if (!plan) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <PrintButton />
      </div>
      <div className="bg-white p-10 shadow print:p-0 print:shadow-none">
        <PlanDocument doc={planToDocModel(plan)} />
      </div>
    </div>
  );
}
