import "server-only";
import { and, count, desc, eq, isNotNull, like } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, businesses, members, notificationSettings, users } from "@/db/schema";
import { saveSmsSettings } from "@/server/actions/sms";
import { referralStatus } from "@/server/actions/billing";
import { businessHas, collaboratorUsage, effectivePlan, onlineBookingsThisMonth } from "@/server/plan";
import { SMS_PRICE_CENTS, WHATSAPP_PRICE_CENTS, usageThisMonth, whatsappConfigured } from "@/server/sms";
import { ensureReferralCode } from "@/server/referral";
import { LIMITS, limitOf, planLabel } from "@/lib/plans";
import { bool, ensureOk, fail, has, type ApiRequest, type Route } from "@/server/api/http";
import { APP_PLAN, needCtx, siteUrl } from "@/server/api/v1/shared";
import type { AppContext } from "@/server/context";

const lim = (n: number) => (Number.isFinite(n) ? { limit: n, unlimited: false } : { limit: null, unlimited: true });
const monthKey = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).format(new Date());

async function overview() {
  const ctx = await needCtx();
  const p = await effectivePlan(ctx.business.id);
  const used = await onlineBookingsThisMonth(ctx.business.id, ctx.business.timezone);
  const auto = limitOf(p.plan, "autoConfirmUpTo");
  const seats = await collaboratorUsage(ctx.business.id);
  return {
    company: { id: ctx.business.id, name: ctx.business.name, isOwner: ctx.member.isOwner },
    plan: APP_PLAN[p.plan],
    planLabel: planLabel(p.plan),
    status: p.status,
    isPaid: p.plan !== "free",
    // En v2 rien n'est bloqué au-delà : les réservations passent « à confirmer ».
    usage: { monthlyBookings: { ...lim(auto), used, reached: used >= auto, monthKey: monthKey(ctx.business.timezone) } },
    limits: { services: lim(limitOf(p.plan, "services")), employees: lim(seats.max), collaborators: lim(seats.max), smsIncluded: LIMITS.smsIncluded[p.plan] },
    manageUrl: siteUrl("/app/reglages/abonnement"),
  };
}

async function ownerOf(ctx: AppContext) {
  const [b] = await db.select({ ownerId: businesses.ownerId }).from(businesses).where(eq(businesses.id, ctx.business.id));
  return b!.ownerId;
}

async function smsSettings(ctx: AppContext) {
  const [n] = await db.select().from(notificationSettings).where(eq(notificationSettings.businessId, ctx.business.id));
  return { smsRemindersEnabled: n?.smsReminders ?? false, smsConfirmationEnabled: n?.smsConfirmations ?? false, whatsappRemindersEnabled: n?.whatsappReminders ?? false, whatsappConfirmationEnabled: n?.whatsappConfirmations ?? false, smsAllowOverage: n?.smsAllowOverage ?? false };
}

async function sms() {
  const ctx = await needCtx();
  const p = await effectivePlan(ctx.business.id);
  const usage = await usageThisMonth(await ownerOf(ctx));
  const included = LIMITS.smsIncluded[p.plan];
  const finance = ctx.can("billing.manage");
  return {
    quota: { included, used: usage.used, remaining: Math.max(0, included - usage.used), monthKey: monthKey(ctx.business.timezone) },
    balance: finance ? { cents: usage.balanceCents, smsPriceCents: SMS_PRICE_CENTS, whatsappPriceCents: WHATSAPP_PRICE_CENTS, smsLeft: Math.floor(usage.balanceCents / SMS_PRICE_CENTS), whatsappLeft: Math.floor(usage.balanceCents / WHATSAPP_PRICE_CENTS) } : null,
    settings: await smsSettings(ctx),
    whatsappConfigured: whatsappConfigured(),
    availableOnPlan: p.plan !== "free",
    autoRecharge: finance ? { enabled: usage.autoRecharge.enabled, thresholdEuros: usage.autoRecharge.thresholdCents / 100, amountEuros: usage.autoRecharge.amountCents / 100, lastFailureAt: null } : null,
    manageUrl: siteUrl("/app/reglages/sms"),
  };
}

async function updateSms(r: ApiRequest) {
  const ctx = await needCtx("settings.manage");
  const cur = await smsSettings(ctx);
  const pick = (k: keyof typeof cur) => (has(r.body, k) ? bool(r.body[k]) : cur[k]);
  ensureOk(await saveSmsSettings({ smsReminders: pick("smsRemindersEnabled"), smsConfirmations: pick("smsConfirmationEnabled"), smsAllowOverage: pick("smsAllowOverage"), whatsappReminders: pick("whatsappRemindersEnabled"), whatsappConfirmations: pick("whatsappConfirmationEnabled") }));
  return { ok: true, settings: await smsSettings(ctx) };
}

async function referral(r: ApiRequest) {
  const [u] = await db.select({ name: users.fullName }).from(users).where(eq(users.id, r.auth!.userId));
  const code = await ensureReferralCode(r.auth!.userId, u?.name ?? "PRO");
  const st = await referralStatus(r.auth!.userId);
  const filleuls = await db.select({ name: users.fullName, joinedAt: users.createdAt, paid: users.referralPaidAt }).from(users).where(eq(users.referredById, r.auth!.userId)).orderBy(desc(users.createdAt)).limit(100);
  return {
    code,
    link: siteUrl(`/inscription?ref=${encodeURIComponent(code)}`),
    stats: { totalInvited: filleuls.length, totalPaying: st.paying, creditMonths: st.claimed, claimableMonths: st.claimable, untilNextReward: 3 - (st.paying % 3) },
    filleuls: filleuls.map((f) => ({ name: f.name.split(" ")[0] ?? f.name, joinedAt: f.joinedAt.toISOString(), isPaying: !!f.paid })),
    manageUrl: siteUrl("/app/reglages/abonnement"),
  };
}

/* ── Journal d'activité (forfait Pro+) ── */

const FAMILIES: Record<string, string> = {
  appointment: "Rendez-vous",
  block: "Créneaux bloqués",
  customer: "Clients",
  service: "Prestations",
  groupSession: "Cours collectifs",
  schedule: "Horaires",
  team: "Équipe",
  grade: "Grades",
  settings: "Réglages",
  booking_page: "Page de réservation",
  form: "Formulaire",
  business: "Établissement",
};

async function logs(r: ApiRequest) {
  const ctx = await needCtx("logs.view");
  if (!(await businessHas(ctx.business.id, "activityLog"))) return fail(403, "plan_required", "Le journal d'activité est inclus dans le forfait Pro+.");
  const page = Math.max(1, Number(r.query.get("page") ?? 1) || 1);
  const action = r.query.get("action") ?? "";
  const family = Object.keys(FAMILIES).includes(action) ? action : "";
  const where = and(eq(activityLogs.businessId, ctx.business.id), family ? like(activityLogs.action, `${family}.%`) : undefined);
  const [{ n }] = await db.select({ n: count() }).from(activityLogs).where(where);
  const rows = await db.select().from(activityLogs).where(where).orderBy(desc(activityLogs.createdAt)).limit(25).offset((page - 1) * 25);
  const owners = await db.select({ userId: members.userId }).from(members).where(and(eq(members.businessId, ctx.business.id), eq(members.isOwner, true), isNotNull(members.userId)));
  const ownerIds = new Set(owners.map((o) => o.userId));
  const totalPages = Math.max(1, Math.ceil(n / 25));
  return {
    logs: rows.map((l) => {
      const fam = l.action.split(".")[0] ?? "";
      const role = l.userId && ownerIds.has(l.userId) ? "owner" : l.userId ? "staff" : "";
      return { id: l.id, date: l.createdAt.toISOString(), userName: l.actorName, role, roleLabel: role === "owner" ? "Propriétaire" : role === "staff" ? "Équipe" : "", action: l.action, actionLabel: FAMILIES[fam] ?? "Autre", description: l.description };
    }),
    actions: [{ value: "all", label: "Tout" }, ...Object.entries(FAMILIES).map(([value, label]) => ({ value, label }))],
    selectedAction: family || "all",
    page,
    totalPages,
    total: n,
    hasMore: page < totalPages,
  };
}

export const billingRoutes: Route[] = [
  { method: "GET", path: "/billing", handler: overview },
  { method: "GET", path: "/billing/sms", handler: sms },
  { method: "PATCH", path: "/billing/sms-settings", handler: updateSms },
  { method: "GET", path: "/billing/referral", handler: referral },
  { method: "GET", path: "/logs", handler: logs },
];
