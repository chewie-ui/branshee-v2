import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { requireContext } from "@/server/context";
import { logRecordAccess } from "@/server/physio";
import { patientExport } from "@/server/patient-export";

/** Export complet du dossier d'un patient (JSON), pour la portabilité et la migration ; l'export est tracé. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("records.export");
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Introuvable", { status: 404 });
  const [c] = await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.businessId, ctx.business.id)));
  if (!c) return new Response("Introuvable", { status: 404 });
  const out = await patientExport(ctx, c);
  await logRecordAccess(ctx, c.id, "export", "Export complet du dossier (JSON)");
  const name = `dossier-${c.fullName}`.normalize("NFD").replace(/[^\w-]+/g, "-").toLowerCase();
  return new Response(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.json"`, "Cache-Control": "private, no-store" } });
}
