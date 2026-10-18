import "server-only";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { appointmentPayments, appointments, bookingSettings, businesses, customers, grades, members, users } from "@/db/schema";
import { currentContext, type AppContext } from "@/server/context";
import { effectivePlan } from "@/server/plan";
import { listMemberships } from "@/server/memberships";
import type { Permissions, PermissionKey } from "@/lib/permissions";
import { planLabel, type Plan } from "@/lib/plans";
import { fail, forbidden } from "@/server/api/http";

/** Forfaits tels que l'application les connaît (noms de l'ancien Branshee). */
export const APP_PLAN: Record<Plan, "basic" | "pro" | "business"> = { free: "basic", pro: "pro", pro_plus: "business" };
export const appPlanLabel = (p: Plan) => planLabel(p);
export const PLACEHOLDER_AVATAR = "/images/no-user.webp";
export const siteUrl = (path = "") => `${(process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "")}${path}`;

/** Contexte de l'établissement actif (paramètre `companyId`), ou erreur 409 si le compte n'en a aucun. */
export async function needCtx(permission?: PermissionKey): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord un établissement.");
  if (permission && !ctx.can(permission)) return forbidden();
  return ctx;
}

/** Permissions du site → forme attendue par l'application (noms de l'ancien Branshee). */
export function appPermissions(ctx: AppContext) {
  const c = (k: PermissionKey) => ctx.can(k);
  return {
    appointments: { view: c("appointments.view"), manage: c("appointments.manage"), cancelDelete: c("appointments.cancel") },
    clients: { view: c("customers.view"), manage: c("customers.manage") },
    services: { view: c("services.view"), manage: c("services.manage") },
    groupSessions: { view: c("groupSessions.view"), manage: c("groupSessions.manage") },
    availability: {
      manageShared: c("availability.manageShared"),
      manageOwnSchedule: c("availability.manageOwnSchedule"),
      manageOthersSchedule: c("availability.manageOthersSchedule"),
      manageOwnTimeOff: c("availability.manageOwnTimeOff"),
      manageOthersTimeOff: c("availability.manageOthersTimeOff"),
    },
    forms: { manage: c("forms.manage") },
    customization: { manage: c("customization.manage") },
    settings: { manage: c("settings.manage") },
    collaborators: { view: c("team.view"), manage: c("team.manage") },
    grades: { view: c("grades.view"), manage: c("grades.manage") },
    logs: { view: c("logs.view") },
    billing: { manage: c("billing.manage") },
    establishment: { manage: c("business.manage"), delete: c("business.delete") },
  };
}

/** Bloc `context` renvoyé à la connexion et par /auth/me. */
export async function appContext(userId: string) {
  const ctx = await currentContext();
  if (!ctx) return null;
  const [biz] = await db.select({ photo: businesses.photoUrl, slot: bookingSettings.slotIntervalMin }).from(businesses).leftJoin(bookingSettings, eq(bookingSettings.businessId, businesses.id)).where(eq(businesses.id, ctx.business.id));
  const plan = await effectivePlan(ctx.business.id);
  const mships = (await listMemberships(userId)).filter((m) => m.status === "active");
  return {
    activeCompany: { id: ctx.business.id, name: ctx.business.name, photo: biz?.photo ?? "", role: await roleLabel(ctx), isOwner: ctx.member.isOwner, slotTime: biz?.slot ?? 30, plan: APP_PLAN[plan.plan] },
    permissions: appPermissions(ctx),
    companies: mships.map((m) => ({ id: m.business.id, name: m.business.name, photo: m.business.photoUrl ?? "", role: m.isOwner ? "Propriétaire" : (m.gradeName ?? "Collaborateur"), isOwner: m.isOwner })),
  };
}

async function roleLabel(ctx: AppContext) {
  if (ctx.member.isOwner) return "Propriétaire";
  const [m] = await db.select({ gradeId: members.gradeId }).from(members).where(eq(members.id, ctx.member.id));
  if (!m?.gradeId) return "Collaborateur";
  const [g] = await db.select({ name: grades.name }).from(grades).where(eq(grades.id, m.gradeId));
  return g?.name ?? "Collaborateur";
}

/** Profil renvoyé à l'application (jamais de champ sensible). */
export async function userProfile(userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return fail(401, "unauthorized", "Compte introuvable.");
  const ctx = await currentContext();
  const plan = ctx ? (await effectivePlan(ctx.business.id)).plan : "free";
  return { id: u.id, fullName: u.fullName, email: u.email, phone: u.phone ?? "", profilePicture: u.avatarUrl ?? PLACEHOLDER_AVATAR, businessName: ctx?.business.name ?? "", preferredLang: u.locale, plan: APP_PLAN[plan] };
}

export async function authPayload(tokens: { accessToken: string; refreshToken: string; tokenType: string; expiresIn: number }, userId: string) {
  return { ...tokens, user: await userProfile(userId), context: await appContext(userId) };
}

/* ── Dates dans le fuseau de l'établissement ── */

export const dayOf = (d: Date, tz: string) => format(new TZDate(d, tz), "yyyy-MM-dd");
export const timeOf = (d: Date, tz: string) => format(new TZDate(d, tz), "HH:mm");
export const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T12:00:00Z`).getTime());
export const isTime = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
/** « 2026-10-19 » + « 10:30 » dans le fuseau → instant. */
export const at = (day: string, time: string, tz: string) => new Date(new TZDate(`${day}T${time}:00`, tz).getTime());

/* ── Rendez-vous au format de l'application ── */

type ApptRow = typeof appointments.$inferSelect;
type Extra = { memberName: string | null; customer?: { fullName: string; email: string | null; phone: string | null } | null; payment?: typeof appointmentPayments.$inferSelect | null };

export function bookingDto(a: ApptRow, x: Extra, tz: string) {
  const pay = x.payment;
  return {
    id: a.id,
    date: dayOf(a.startsAt, tz),
    startTime: timeOf(a.startsAt, tz),
    endTime: timeOf(a.endsAt, tz),
    slotTime: Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60000),
    status: a.status === "cancelled" ? "canceled" : "confirmed",
    /** Demande à confirmer (réservation en ligne sans confirmation automatique). */
    pending: a.status === "pending",
    isGroup: !!a.groupSessionId,
    isBlock: a.kind === "block",
    noShow: a.noShow,
    serviceName: a.kind === "block" ? "Créneau bloqué" : (a.serviceName ?? ""),
    serviceColor: a.serviceColor ?? "",
    employeeName: x.memberName ?? "",
    employeeId: a.memberId,
    client: {
      id: a.customerId,
      name: x.customer?.fullName ?? a.contactName ?? "",
      email: a.contactEmail ?? x.customer?.email ?? "",
      phone: a.contactPhone ?? x.customer?.phone ?? "",
      profilePicture: null,
    },
    message: a.customerMessage ?? "",
    adminNotes: a.internalNote ?? "",
    payment: { method: pay?.method ?? "none", status: pay?.status ?? "none", amount: (pay?.amountCents ?? 0) / 100, currency: (pay?.currency ?? "eur").toUpperCase() },
    formAnswers: a.formAnswers ?? [],
  };
}

/** Charge des RDV avec praticien, client et paiement, puis les met au format de l'application. */
export async function loadBookings(where: Parameters<typeof and>, tz: string, opts: { limit?: number } = {}) {
  const q = db
    .select({ a: appointments, memberName: members.displayName, customer: { fullName: customers.fullName, email: customers.email, phone: customers.phone }, payment: appointmentPayments })
    .from(appointments)
    .leftJoin(members, eq(members.id, appointments.memberId))
    .leftJoin(customers, eq(customers.id, appointments.customerId))
    .leftJoin(appointmentPayments, eq(appointmentPayments.appointmentId, appointments.id))
    .where(and(...where))
    .orderBy(asc(appointments.startsAt));
  const rows = opts.limit ? await q.limit(opts.limit) : await q;
  return rows.map((r) => bookingDto(r.a, { memberName: r.memberName, customer: r.customer?.fullName ? r.customer : null, payment: r.payment }, tz));
}

export async function bookingById(ctx: AppContext, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "not_found", "Rendez-vous introuvable.");
  const [b] = await loadBookings([eq(appointments.id, id), eq(appointments.businessId, ctx.business.id)], ctx.business.timezone);
  return b ?? fail(404, "not_found", "Rendez-vous introuvable.");
}

/** Membres affichables (prénom / nom séparés comme dans l'ancien Branshee). */
export function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

export async function membersOf(businessId: string, ids?: string[]) {
  const where = [eq(members.businessId, businessId), eq(members.status, "active")];
  if (ids?.length) where.push(inArray(members.id, ids));
  return db.select().from(members).where(and(...where)).orderBy(asc(members.createdAt));
}

export type { Permissions };
