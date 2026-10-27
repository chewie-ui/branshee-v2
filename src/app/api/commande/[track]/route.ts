import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tableOrders } from "@/db/schema";
import { CUSTOMER_STATUS, isOrderStatus } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** Suivi d'une commande à table par le client (jeton secret reçu à l'envoi) : numéro et état seulement. */
export async function GET(_req: Request, { params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  if (!/^[\w-]{20,40}$/.test(track)) return Response.json({ error: "Introuvable" }, { status: 404 });
  const [o] = await db.select({ number: tableOrders.number, status: tableOrders.status, table: tableOrders.tableLabel }).from(tableOrders).where(eq(tableOrders.trackToken, track));
  if (!o || !isOrderStatus(o.status)) return Response.json({ error: "Introuvable" }, { status: 404 });
  return Response.json({ number: o.number, status: o.status, label: CUSTOMER_STATUS[o.status], table: o.table }, { headers: { "Cache-Control": "no-store" } });
}
