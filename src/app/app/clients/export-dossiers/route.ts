import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { requireContext } from "@/server/context";
import { logRecordAccess } from "@/server/physio";
import { patientExport } from "@/server/patient-export";

/**
 * Export de tous les dossiers du cabinet (JSON lisible), pour changer de logiciel ou garder une archive.
 * Réservé au responsable de l'établissement ; construit patient par patient (flux), l'export est tracé.
 */
export async function GET() {
  const ctx = await requireContext("records.export");
  if (!ctx.member.isOwner && !ctx.can("business.manage")) return new Response("Réservé au responsable de l'établissement.", { status: 403 });
  const ids = await db.select({ id: customers.id }).from(customers).where(eq(customers.businessId, ctx.business.id)).orderBy(asc(customers.createdAt));
  await logRecordAccess(ctx, null, "export", `Export de tous les dossiers (${ids.length})`);
  const enc = new TextEncoder();
  let i = 0;
  let wrote = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(enc.encode(`{"format":"skydev-practice-export","version":2,"documentation":"/app/aide/dossier-kine#format-export","exportedAt":${JSON.stringify(new Date().toISOString())},"business":${JSON.stringify({ id: ctx.business.id, name: ctx.business.name })},"patients":[\n`));
    },
    async pull(controller) {
      const next = ids[i];
      if (!next) {
        controller.enqueue(enc.encode("\n]}\n"));
        controller.close();
        return;
      }
      const [c] = await db.select().from(customers).where(eq(customers.id, next.id));
      if (c) {
        const full: Record<string, unknown> = await patientExport(ctx, c);
        for (const k of ["format", "version", "documentation", "exportedAt", "business"]) delete full[k];
        controller.enqueue(enc.encode(`${wrote ? ",\n" : ""}${JSON.stringify(full)}`));
        wrote = true;
      }
      i++;
    },
  });
  const day = new Date().toISOString().slice(0, 10);
  return new Response(stream, { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="dossiers-${day}.json"`, "Cache-Control": "private, no-store" } });
}
