import "server-only";
import { createHash } from "node:crypto";
import { statfs } from "node:fs/promises";
import { and, desc, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailLogs, errorLogs, jobRuns } from "@/db/schema";
import { isNoise, normalizeMessage, routeOf } from "@/lib/health";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";

// Alertes techniques : adresse dédiée si configurée (HEALTH_ALERT_EMAIL), sinon la boîte de contact.
const alertTo = () => process.env.HEALTH_ALERT_EMAIL || process.env.SKYDEV_CONTACT_EMAIL || "info@skydev.be";

/**
 * Note une erreur de la plateforme (regroupée par empreinte). Nouvelle erreur, ou erreur résolue qui
 * revient : email d'alerte (au plus un toutes les 6 h par erreur, 20 par jour). Ne lève jamais.
 */
export async function recordError(e: { source: "server" | "stripe" | "cron"; message: string; detail?: string | null; path?: string | null }) {
  try {
    if (!e.message || isNoise(e.message)) return;
    const route = routeOf(e.path);
    const fingerprint = createHash("sha1").update(`${e.source}|${normalizeMessage(e.message)}|${route ?? ""}`).digest("hex");
    const [row] = await db
      .insert(errorLogs)
      .values({ fingerprint, source: e.source, message: e.message.slice(0, 1000), detail: e.detail?.slice(0, 4000) ?? null, path: route })
      .onConflictDoUpdate({ target: errorLogs.fingerprint, set: { count: sql`${errorLogs.count} + 1`, lastSeenAt: new Date(), resolvedAt: null, detail: e.detail?.slice(0, 4000) ?? null } })
      .returning({ id: errorLogs.id, count: errorLogs.count, notifiedAt: errorLogs.notifiedAt });
    if (!row) return;
    const due = !row.notifiedAt || Date.now() - row.notifiedAt.getTime() > 6 * 3600_000;
    if (!due) return;
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(errorLogs).where(gte(errorLogs.notifiedAt, new Date(Date.now() - 86400_000)));
    if (n >= 20) return;
    const claimed = await db.update(errorLogs).set({ notifiedAt: new Date() }).where(sql`${errorLogs.id} = ${row.id} and (${errorLogs.notifiedAt} is null or ${errorLogs.notifiedAt} < now() - interval '6 hours')`).returning({ id: errorLogs.id });
    if (!claimed.length) return;
    const base = (process.env.SKYDEV_APP_URL ?? process.env.APP_URL ?? "https://skydev.be").replace(/\/$/, "");
    await sendEmail({
      to: alertTo(),
      ...emails.skydevTeamAlert({ subject: `Erreur ${e.source === "stripe" ? "Stripe" : e.source === "cron" ? "tâche automatique" : "du site"} : ${e.message.slice(0, 80)}`, title: "Nouvelle erreur sur la plateforme", intro: `Une erreur vient de se produire${row.count > 1 ? ` (${row.count} fois au total)` : ""}. Détails et suivi dans Admin › Santé : ${base}/admin/sante`, details: [{ label: "Où", value: route ?? "—" }, { label: "Message", value: e.message.slice(0, 300) }], note: "Alerte technique automatique : aucun client n'a reçu ce message." }),
      template: "health_alert",
    }).catch(() => {});
  } catch {
    /* le suivi des erreurs ne doit jamais casser la page */
  }
}

/** Exécute une tâche automatique en notant son passage (et son erreur éventuelle). */
export async function trackJob<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    const r = await fn();
    const values = { lastRunAt: new Date(), lastOkAt: new Date(), ok: true, durationMs: Date.now() - t0, result: JSON.stringify(r).slice(0, 2000) };
    await db.insert(jobRuns).values({ name, ...values }).onConflictDoUpdate({ target: jobRuns.name, set: values }).catch(() => {});
    return r;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const values = { lastRunAt: new Date(), ok: false, durationMs: Date.now() - t0, result: msg.slice(0, 2000) };
    await db.insert(jobRuns).values({ name, ...values }).onConflictDoUpdate({ target: jobRuns.name, set: values }).catch(() => {});
    await recordError({ source: "cron", message: `${name} : ${msg}`, detail: e instanceof Error ? e.stack : null, path: `/api/cron/${name}` });
    throw e;
  }
}

/** Tout ce que la page Santé affiche. */
export async function healthSnapshot() {
  const week = new Date(Date.now() - 7 * 86400_000);
  const [errors, mails, mailStats, pastDue, jobs, [dbSize]] = await Promise.all([
    db.select().from(errorLogs).where(isNull(errorLogs.resolvedAt)).orderBy(desc(errorLogs.lastSeenAt)).limit(100),
    db.select({ at: emailLogs.createdAt, to: emailLogs.toEmail, template: emailLogs.template, subject: emailLogs.subject, error: emailLogs.error }).from(emailLogs).where(and(gte(emailLogs.createdAt, week), sql`${emailLogs.status} = 'failed'`)).orderBy(desc(emailLogs.createdAt)).limit(50),
    db.select({ status: emailLogs.status, n: sql<number>`count(*)::int` }).from(emailLogs).where(gte(emailLogs.createdAt, week)).groupBy(emailLogs.status),
    db.execute<{ id: string; name: string; status: string; period_end: Date | null }>(sql`select b.id, b.name, p.status, p.period_end from business_plans p join businesses b on b.id = p.business_id where p.status = 'past_due' and b.deleted_at is null order by p.updated_at desc limit 50`),
    db.select().from(jobRuns),
    db.execute<{ size: string }>(sql`select pg_size_pretty(pg_database_size(current_database())) as size`),
  ]);
  let disk: { freeGb: number; totalGb: number } | null = null;
  try {
    const s = await statfs(process.env.STORAGE_DIR || process.cwd());
    disk = { freeGb: Math.round(((s.bavail * s.bsize) / 1e9) * 10) / 10, totalGb: Math.round(((s.blocks * s.bsize) / 1e9) * 10) / 10 };
  } catch {
    disk = null;
  }
  const mem = process.memoryUsage();
  return {
    errors,
    mails,
    mailStats: Object.fromEntries(mailStats.map((m) => [m.status, m.n])) as Record<string, number>,
    pastDue: [...pastDue],
    jobs,
    system: { uptimeH: Math.round((process.uptime() / 3600) * 10) / 10, memMb: Math.round(mem.rss / 1e6), dbSize: dbSize?.size ?? "?", disk, node: process.version },
    config: {
      stripe: !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET,
      smtp: !!process.env.SMTP_URL,
      encryption: !!process.env.DATA_ENCRYPTION_KEY,
      google: !!process.env.GOOGLE_CLIENT_ID,
      ai: !!process.env.ANTHROPIC_API_KEY,
    },
  };
}
