import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { customers, recordAccessLogs } from "@/db/schema";
import { requireContext } from "@/server/context";
import { logRecordAccess } from "@/server/physio";
import { toCsv } from "@/server/csv";

/** Journal des accès aux dossiers patients (12 derniers mois), en CSV. L'export lui-même est tracé. */
export async function GET() {
  const ctx = await requireContext("logs.view");
  const since = new Date(Date.now() - 365 * 86400e3);
  const rows = await db
    .select({ at: recordAccessLogs.at, user: recordAccessLogs.userName, action: recordAccessLogs.action, detail: recordAccessLogs.detail, patient: customers.fullName })
    .from(recordAccessLogs)
    .leftJoin(customers, eq(customers.id, recordAccessLogs.customerId))
    .where(and(eq(recordAccessLogs.businessId, ctx.business.id), gte(recordAccessLogs.at, since)))
    .orderBy(desc(recordAccessLogs.at))
    .limit(100000);
  await logRecordAccess(ctx, null, "export", "Export du journal des accès");
  const label: Record<string, string> = { view: "Consultation", edit: "Modification", export: "Export", print: "Impression" };
  const fmt = new Intl.DateTimeFormat("fr-BE", { timeZone: ctx.business.timezone, dateStyle: "short", timeStyle: "medium" });
  // toCsv : cellules protégées contre l'injection de formules (un nom de patient « =HYPERLINK(…) » ne s'exécute pas dans Excel).
  const body = toCsv(["Date", "Utilisateur", "Patient", "Action", "Détail"], rows.map((r) => [fmt.format(r.at), r.user, r.patient ?? "", label[r.action] ?? r.action, r.detail ?? ""]));
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="journal-acces-dossiers.csv"`, "Cache-Control": "private, no-store" } });
}
