import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingPageSettings, bookingSettings, serviceCategories, services } from "@/db/schema";
import { decidePenalty, deleteAppointments, savePayment, sendClientMessage, sendReminderNow } from "@/server/actions/appointments";
import { deleteCategory, moveCategory, moveService, saveCategory } from "@/server/actions/services";
import { saveBookingRules } from "@/server/actions/settings";
import { bool, ensureOk, fail, formData, has, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { bookingById, needCtx } from "@/server/api/v1/shared";

/**
 * Compléments de l'API mobile pour l'app RDV de Skydev : les mêmes actions que les pages du site
 * (fiche RDV, catégories, ordre des prestations, page de réservation, règles de réservation).
 */

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const origin = () => (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");

/* ── Fiche RDV : message, rappel, paiement, pénalité, suppression ── */

async function message(r: ApiRequest) {
  const ctx = await needCtx("appointments.manage");
  await bookingById(ctx, r.params.id!);
  const res = await sendClientMessage(r.params.id!, str(r.body.message, 1000));
  if (!res.ok) return invalid(res.error ?? "Message non envoyé.");
  return { ok: true };
}

async function reminder(r: ApiRequest) {
  const ctx = await needCtx("appointments.manage");
  await bookingById(ctx, r.params.id!);
  const res = await sendReminderNow(r.params.id!);
  if (!res.ok) return invalid(res.error ?? "Rappel non envoyé.");
  return { ok: true };
}

async function payment(r: ApiRequest) {
  const ctx = await needCtx("appointments.manage");
  await bookingById(ctx, r.params.id!);
  const res = await savePayment(r.params.id!, { method: str(r.body.method, 20) as never, status: str(r.body.status, 20) as never, amount: str(r.body.amount, 12).replace(".", ",") });
  if (!res.ok) return invalid(res.error ?? "Paiement non enregistré.");
  return { booking: await bookingById(ctx, r.params.id!) };
}

async function penalty(r: ApiRequest) {
  const ctx = await needCtx("appointments.manage");
  await bookingById(ctx, r.params.id!);
  const decision = r.body.decision === "refunded" ? "refunded" : r.body.decision === "kept" ? "kept" : null;
  if (!decision) return invalid("Décision inconnue.");
  ensureOk(await decidePenalty(r.params.id!, decision));
  return { booking: await bookingById(ctx, r.params.id!) };
}

async function removeBookings(r: ApiRequest) {
  await needCtx("appointments.cancel");
  const ids = Array.isArray(r.body.ids) ? (r.body.ids as unknown[]).filter(uuid) as string[] : [];
  if (!ids.length) return invalid("Aucun rendez-vous sélectionné.");
  const res = await deleteAppointments(ids.slice(0, 500));
  return { ok: true, deleted: res.deleted };
}

/* ── Catégories de prestations ── */

async function categories() {
  const ctx = await needCtx("services.view");
  const rows = await db.select().from(serviceCategories).where(eq(serviceCategories.businessId, ctx.business.id)).orderBy(asc(serviceCategories.position), asc(serviceCategories.name));
  const counts = await db.select({ id: services.categoryId, n: count() }).from(services).where(eq(services.businessId, ctx.business.id)).groupBy(services.categoryId);
  const [s] = await db.select({ style: bookingPageSettings.categoryStyle }).from(bookingPageSettings).where(eq(bookingPageSettings.businessId, ctx.business.id));
  return { style: s?.style ?? "pills", categories: rows.map((c) => ({ id: c.id, name: c.name, icon: c.icon ?? "", serviceCount: counts.find((x) => x.id === c.id)?.n ?? 0 })) };
}

async function saveCat(r: ApiRequest, id: string | null) {
  await needCtx("services.manage");
  if (id && !uuid(id)) return fail(404, "not_found", "Catégorie introuvable.");
  ensureOk(await saveCategory(id, { name: str(r.body.name, 50), icon: str(r.body.icon, 40) }));
  return categories();
}

/* ── Page de réservation : lien public et règles de réservation ── */

async function bookingPage() {
  const ctx = await needCtx();
  const url = `${origin()}/${ctx.business.slug}`;
  return { slug: ctx.business.slug, url, name: ctx.business.name, canCustomize: ctx.can("customization.manage") };
}

async function rules() {
  const ctx = await needCtx("settings.manage");
  const [s] = await db.select().from(bookingSettings).where(eq(bookingSettings.businessId, ctx.business.id));
  if (!s) return fail(404, "not_found", "Réglages introuvables.");
  return {
    rules: {
      slotMode: s.slotMode,
      slotIntervalMin: s.slotIntervalMin,
      bufferBeforeMin: s.bufferBeforeMin,
      bufferAfterMin: s.bufferAfterMin,
      minLeadMin: s.minLeadMin,
      horizonDays: s.horizonDays,
      autoConfirm: s.autoConfirm,
      phoneRequired: s.phoneRequired,
      waitlistEnabled: s.waitlistEnabled,
      allowOverbooking: s.allowOverbooking,
      firstVisitQuestion: s.firstVisitQuestion,
      smartGrouping: s.smartGrouping,
    },
  };
}

async function saveRules(r: ApiRequest) {
  const cur = (await rules()).rules;
  const b = r.body;
  const pick = <K extends keyof typeof cur>(k: K) => (has(b, k) ? (b[k] as (typeof cur)[K]) : cur[k]);
  const fv = pick("firstVisitQuestion");
  const sg = pick("smartGrouping");
  const res = await saveBookingRules(
    undefined,
    formData({
      slotMode: String(pick("slotMode")),
      slotIntervalMin: Number(pick("slotIntervalMin")),
      bufferBeforeMin: Number(pick("bufferBeforeMin")),
      bufferAfterMin: Number(pick("bufferAfterMin")),
      minLeadMin: pick("minLeadMin") == null ? "" : Number(pick("minLeadMin")),
      horizonDays: pick("horizonDays") == null ? "" : Number(pick("horizonDays")),
      autoConfirm: bool(pick("autoConfirm")),
      phoneRequired: bool(pick("phoneRequired")),
      waitlistEnabled: bool(pick("waitlistEnabled")),
      allowOverbooking: bool(pick("allowOverbooking")),
      fvEnabled: !!fv?.enabled,
      fvQuestion: fv?.question ?? "",
      fvNew: fv?.newLabel ?? "",
      fvExisting: fv?.existingLabel ?? "",
      sgEnabled: !!sg?.enabled,
      sgWindow: String(sg?.windowHours ?? 3),
      sgWeekdays: (sg?.weekdays ?? []).join(","),
    }),
  );
  ensureOk(res as never);
  return rules();
}

export const rdvExtraRoutes: Route[] = [
  { method: "POST", path: "/bookings/:id/message", handler: message },
  { method: "POST", path: "/bookings/:id/reminder", handler: reminder },
  { method: "PATCH", path: "/bookings/:id/payment", handler: payment },
  { method: "PATCH", path: "/bookings/:id/penalty", handler: penalty },
  { method: "POST", path: "/bookings/delete", handler: removeBookings },

  { method: "GET", path: "/categories", handler: categories },
  { method: "POST", path: "/categories", handler: (r) => saveCat(r, null) },
  { method: "PATCH", path: "/categories/:id", handler: (r) => saveCat(r, r.params.id!) },
  {
    method: "PATCH",
    path: "/categories/:id/move",
    handler: async (r) => {
      await needCtx("services.manage");
      if (!uuid(r.params.id)) return fail(404, "not_found", "Catégorie introuvable.");
      await moveCategory(r.params.id!, r.body.direction === "up" ? "up" : "down");
      return categories();
    },
  },
  {
    method: "DELETE",
    path: "/categories/:id",
    handler: async (r) => {
      await needCtx("services.manage");
      if (!uuid(r.params.id)) return fail(404, "not_found", "Catégorie introuvable.");
      await deleteCategory(r.params.id!);
      return categories();
    },
  },
  {
    method: "PATCH",
    path: "/services/:id/move",
    handler: async (r) => {
      const ctx = await needCtx("services.manage");
      if (!uuid(r.params.id)) return fail(404, "not_found", "Prestation introuvable.");
      const [s] = await db.select({ id: services.id }).from(services).where(and(eq(services.id, r.params.id!), eq(services.businessId, ctx.business.id)));
      if (!s) return fail(404, "not_found", "Prestation introuvable.");
      await moveService(s.id, r.body.direction === "up" ? "up" : "down");
      return { ok: true };
    },
  },

  { method: "GET", path: "/booking-page", handler: bookingPage },
  { method: "GET", path: "/booking-rules", handler: rules },
  { method: "PATCH", path: "/booking-rules", handler: saveRules },
];
