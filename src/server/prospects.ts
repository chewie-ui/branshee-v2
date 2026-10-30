import "server-only";
import { and, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { members, prospectCalls, prospectScripts, prospects } from "@/db/schema";
import { callQueue, callStats, isProspectStatus, MAX_ATTEMPTS, type ProspectStatus } from "@/lib/prospects";

export type ProspectView = {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  trade: string | null;
  note: string | null;
  status: string;
  attempts: number;
  lastCallAt: string | null;
  callbackAt: string | null;
  refuseReason: string | null;
  dealId: string | null;
};

const view = (p: typeof prospects.$inferSelect): ProspectView => ({
  id: p.id,
  name: p.name,
  company: p.company,
  phone: p.phone,
  email: p.email,
  city: p.city,
  trade: p.trade,
  note: p.note,
  status: p.status,
  attempts: p.attempts,
  lastCallAt: p.lastCallAt?.toISOString() ?? null,
  callbackAt: p.callbackAt?.toISOString() ?? null,
  refuseReason: p.refuseReason,
  dealId: p.dealId,
});

const like = (s: string) => `%${s.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

/** Liste filtrée (statut « injoignable » = sans réponse après le nombre maximum d'appels). */
export async function listProspects(businessId: string, opts: { status?: string; q?: string } = {}) {
  const conds = [eq(prospects.businessId, businessId)];
  if (opts.status === "unreachable") conds.push(eq(prospects.status, "no_answer"), gte(prospects.attempts, MAX_ATTEMPTS));
  else if (isProspectStatus(opts.status)) conds.push(eq(prospects.status, opts.status));
  if (opts.q) conds.push(or(ilike(prospects.name, like(opts.q)), ilike(prospects.company, like(opts.q)), ilike(prospects.phone, like(opts.q)), ilike(prospects.city, like(opts.q)), ilike(prospects.trade, like(opts.q)))!);
  const rows = await db.select().from(prospects).where(and(...conds)).orderBy(desc(prospects.updatedAt)).limit(500);
  return rows.map(view);
}

/** Nombre de prospects par statut. */
export async function prospectCounts(businessId: string) {
  const rows = await db.select({ status: prospects.status, n: sql<number>`count(*)::int`, unreachable: sql<number>`count(*) filter (where ${prospects.attempts} >= ${MAX_ATTEMPTS} and ${prospects.status} = 'no_answer')::int` }).from(prospects).where(eq(prospects.businessId, businessId)).groupBy(prospects.status);
  const out: Record<string, number> = { total: 0, unreachable: 0 };
  for (const r of rows) { out[r.status] = r.n; out.total! += r.n; out.unreachable! += r.unreachable; }
  return out;
}

/** File d'appels : les prospects à appeler maintenant, dans l'ordre. */
export async function callQueueOf(businessId: string, now = new Date()) {
  const rows = await db.select().from(prospects).where(and(eq(prospects.businessId, businessId), inArray(prospects.status, ["todo", "callback", "no_answer"]))).limit(5000);
  return callQueue(rows, now).map(view);
}

/** Prochains rappels promis (plus tard aujourd'hui ou les jours suivants). */
export async function upcomingCallbacks(businessId: string, now = new Date()) {
  const rows = await db.select().from(prospects).where(and(eq(prospects.businessId, businessId), eq(prospects.status, "callback"), sql`${prospects.callbackAt} > ${now.toISOString()}`)).orderBy(prospects.callbackAt).limit(20);
  return rows.map(view);
}

export async function prospectHistory(businessId: string, prospectId: string) {
  return db
    .select({ id: prospectCalls.id, outcome: prospectCalls.outcome, note: prospectCalls.note, at: prospectCalls.createdAt, who: members.displayName })
    .from(prospectCalls)
    .leftJoin(members, eq(members.id, prospectCalls.memberId))
    .where(and(eq(prospectCalls.businessId, businessId), eq(prospectCalls.prospectId, prospectId)))
    .orderBy(desc(prospectCalls.createdAt))
    .limit(30);
}

/** Statistiques d'appels depuis une date (aujourd'hui, 7 jours, 30 jours). */
export async function prospectStats(businessId: string, since: Date) {
  const [calls, refused] = await Promise.all([
    db.select({ outcome: prospectCalls.outcome }).from(prospectCalls).where(and(eq(prospectCalls.businessId, businessId), gte(prospectCalls.createdAt, since))),
    db.select({ r: prospects.refuseReason }).from(prospects).where(and(eq(prospects.businessId, businessId), eq(prospects.status, "refused" satisfies ProspectStatus))),
  ]);
  return callStats(calls, refused.map((x) => x.r));
}

export async function prospectScript(businessId: string) {
  const [s] = await db.select({ body: prospectScripts.body }).from(prospectScripts).where(eq(prospectScripts.businessId, businessId));
  return s?.body ?? "";
}
