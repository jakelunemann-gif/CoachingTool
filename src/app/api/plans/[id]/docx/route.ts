import { getPlan } from "@/lib/data";
import { docToDocx } from "@/lib/export/docx";
import { planToDocModel } from "@/lib/export/docModel";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const plan = await getPlan((await params).id);
  if (!plan) return new Response("Plan not found", { status: 404 });
  const buf = await docToDocx(planToDocModel(plan));
  const filename = `${plan.title.replace(/[^\w .-]/g, "")}.docx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
