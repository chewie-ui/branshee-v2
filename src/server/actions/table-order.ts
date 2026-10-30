"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { menuItems, tableOrders, type OrderLine } from "@/db/schema";
import { clientIp } from "@/lib/client-ip";
import { MAX_LINES, MAX_QTY } from "@/lib/orders";
import { rateLimit } from "@/server/auth/rate-limit";
import { tableByToken } from "@/server/orders";

type Result = { ok: true; number: number; track: string } | { ok: false; error: string };

const schema = z.object({
  token: z.string().regex(/^[\w-]{10,40}$/),
  lines: z.array(z.object({ itemId: z.uuid(), qty: z.number().int().min(1).max(MAX_QTY), note: z.string().trim().max(120).optional() })).min(1, "Votre commande est vide.").max(MAX_LINES),
  name: z.string().trim().max(60),
  note: z.string().trim().max(300),
});

/**
 * Commande envoyée par un client depuis le QR code de sa table (sans compte). Les prix viennent toujours
 * de la carte en base, jamais du navigateur. Limité par adresse IP et par table contre les abus.
 */
export async function placeTableOrder(input: z.input<typeof schema>): Promise<Result> {
  const v = schema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Commande invalide." };
  const ip = clientIp(await headers()) ?? "inconnue";
  if (!rateLimit(`order:${ip}`, 12, 10 * 60_000).ok || !rateLimit(`order-table:${v.data.token}`, 30, 10 * 60_000).ok) return { ok: false, error: "Trop de commandes d'un coup. Patientez un instant ou appelez le personnel." };
  const t = await tableByToken(v.data.token);
  if (!t) return { ok: false, error: "Ce QR code n'est plus valable. Demandez-en un autre au personnel." };
  const ids = [...new Set(v.data.lines.map((l) => l.itemId))];
  const items = await db.select().from(menuItems).where(and(eq(menuItems.businessId, t.business.id), inArray(menuItems.id, ids), eq(menuItems.available, true)));
  const byId = new Map(items.map((i) => [i.id, i]));
  const missing = v.data.lines.filter((l) => !byId.has(l.itemId));
  if (missing.length) return { ok: false, error: "Un plat de votre commande n'est plus disponible. Retirez-le et renvoyez." };
  const lines: OrderLine[] = v.data.lines.map((l) => {
    const it = byId.get(l.itemId)!;
    return { itemId: it.id, name: it.name, priceCents: it.priceCents, qty: l.qty, ...(l.note ? { note: l.note } : {}) };
  });
  const total = lines.reduce((a, l) => a + l.priceCents * l.qty, 0);
  const track = randomBytes(18).toString("base64url");
  // Numéro du jour (dans le fuseau de l'établissement), attribué sous verrou pour ne jamais avoir deux fois le même.
  const tz = t.business.timezone || "Europe/Brussels";
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const number = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`orders:${t.business.id}`}))`);
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(tableOrders)
      .where(and(eq(tableOrders.businessId, t.business.id), gte(tableOrders.createdAt, sql`(${day}::date)::timestamp at time zone ${tz}`)));
    const num = n + 1;
    await tx.insert(tableOrders).values({ businessId: t.business.id, tableId: t.table.id, tableLabel: t.table.label, number: num, lines, totalCents: total, customerName: v.data.name || null, note: v.data.note || null, trackToken: track });
    return num;
  });
  return { ok: true, number, track };
}
