import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { formQuestions, serviceCategories, serviceHours, serviceMembers, services } from "@/db/schema";
import { deleteService, saveService, toggleService } from "@/server/actions/services";
import { saveFormQuestions } from "@/server/actions/booking-page";
import { effectivePlan } from "@/server/plan";
import { limitOf } from "@/lib/plans";
import { bool, ensureOk, fail, formData, has, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { membersOf, needCtx, splitName } from "@/server/api/v1/shared";

const uuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const hhmm = (t: string) => t.slice(0, 5);

async function serviceDtos(businessId: string, opts: { includeInactive?: boolean; ids?: string[] } = {}) {
  const where = [eq(services.businessId, businessId)];
  if (!opts.includeInactive) where.push(eq(services.isActive, true));
  if (opts.ids) where.push(inArray(services.id, opts.ids));
  const rows = await db.select({ s: services, category: serviceCategories.name }).from(services).leftJoin(serviceCategories, eq(serviceCategories.id, services.categoryId)).where(and(...where)).orderBy(asc(services.position), asc(services.createdAt));
  const ids = rows.map((r) => r.s.id);
  const links = ids.length ? await db.select().from(serviceMembers).where(inArray(serviceMembers.serviceId, ids)) : [];
  return rows.map(({ s, category }) => ({
    id: s.id,
    name: s.name,
    description: s.description ?? "",
    category: category ?? "",
    duration: s.durationMin,
    durationMax: s.durationMaxMin,
    price: s.priceCents == null ? null : s.priceCents / 100,
    color: s.color,
    type: s.kind,
    capacity: s.capacity,
    active: s.isActive,
    employeeIds: links.filter((l) => l.serviceId === s.id).map((l) => l.memberId),
  }));
}

async function serviceDto(businessId: string, id: string) {
  const [s] = await serviceDtos(businessId, { includeInactive: true, ids: [id] });
  return s ?? fail(404, "not_found", "Prestation introuvable.");
}

const isRedirect = (e: unknown) => String((e as { digest?: string })?.digest ?? "").startsWith("NEXT_REDIRECT");

/** Création / modification : on complète avec les valeurs actuelles (plages horaires, frais d'annulation…) pour ne rien perdre. */
async function save(r: ApiRequest, id: string | null) {
  const ctx = await needCtx("services.manage");
  const bid = ctx.business.id;
  const b = r.body;
  const [cur] = id ? await db.select().from(services).where(and(eq(services.id, id), eq(services.businessId, bid))) : [null];
  if (id && !cur) return fail(404, "not_found", "Prestation introuvable.");
  const currentMembers = id ? (await db.select({ m: serviceMembers.memberId }).from(serviceMembers).where(eq(serviceMembers.serviceId, id))).map((x) => x.m) : [];
  const hours = id ? await db.select().from(serviceHours).where(eq(serviceHours.serviceId, id)) : [];
  const week: Record<string, { start: string; end: string }[]> = {};
  for (const h of hours) (week[String(h.weekday)] ??= []).push({ start: hhmm(h.startTime), end: hhmm(h.endTime) });

  // Catégorie : l'application envoie un nom.
  let categoryId = cur?.categoryId ?? "";
  let newCategory = "";
  if (has(b, "category")) {
    const name = str(b.category, 50);
    if (!name) categoryId = "";
    else {
      const [cat] = await db.select({ id: serviceCategories.id }).from(serviceCategories).where(and(eq(serviceCategories.businessId, bid), eq(serviceCategories.name, name)));
      if (cat) categoryId = cat.id;
      else {
        categoryId = "__new";
        newCategory = name;
      }
    }
  }
  const price = has(b, "price") ? (b.price == null || b.price === "" ? "" : String(b.price).replace(".", ",")) : cur?.priceCents == null ? "" : String(cur.priceCents / 100).replace(".", ",");
  const kind = has(b, "type") ? (b.type === "group" ? "group" : "individual") : (cur?.kind ?? "individual");
  const employeeIds = has(b, "employeeIds") && Array.isArray(b.employeeIds) ? (b.employeeIds as unknown[]).filter((x): x is string => typeof x === "string" && uuid(x)) : currentMembers;
  const fd = formData({
    name: has(b, "name") ? str(b.name, 80) : (cur?.name ?? ""),
    description: has(b, "description") ? str(b.description, 500) : (cur?.description ?? ""),
    categoryId,
    newCategory,
    durationMin: has(b, "duration") ? Number(b.duration) : (cur?.durationMin ?? 30),
    durationMaxMin: has(b, "durationMax") ? (b.durationMax == null || b.durationMax === "" ? "" : Number(b.durationMax)) : (cur?.durationMaxMin ?? ""),
    price,
    color: has(b, "color") && typeof b.color === "string" && b.color ? b.color : (cur?.color ?? "#4f46e5"),
    audience: cur?.audience ?? "all",
    isActive: has(b, "active") ? bool(b.active) : (cur?.isActive ?? true),
    memberIds: employeeIds,
    kind,
    blocksIndividual: cur?.blocksIndividual ?? true,
    capacity: has(b, "capacity") ? (b.capacity == null || b.capacity === "" ? "" : Number(b.capacity)) : (cur?.capacity ?? ""),
    location: cur?.location ?? "",
    feeEnabled: !!cur?.cancellationFeeType,
    feeType: cur?.cancellationFeeType ?? "percent",
    feeValue: cur?.cancellationFeeValue == null ? "" : cur.cancellationFeeType === "amount" ? String(cur.cancellationFeeValue / 100).replace(".", ",") : String(cur.cancellationFeeValue),
    hours: JSON.stringify(week),
  });
  try {
    const res = await saveService(id, undefined, fd);
    if (res?.error) return invalid(res.fieldErrors ? (Object.values(res.fieldErrors)[0] ?? res.error) : res.error, res.fieldErrors ? { fieldErrors: res.fieldErrors } : {});
  } catch (e) {
    if (!isRedirect(e)) throw e;
  }
  if (id) return { service: await serviceDto(bid, id) };
  const [latest] = await db.select({ id: services.id }).from(services).where(eq(services.businessId, bid)).orderBy(desc(services.createdAt)).limit(1);
  return { service: await serviceDto(bid, latest!.id) };
}

async function team(r: ApiRequest) {
  void r;
  const ctx = await needCtx("services.view");
  const rows = (await membersOf(ctx.business.id)).filter((m) => m.isActive);
  return {
    team: rows.map((m) => ({ id: m.id, ...splitName(m.displayName), photo: m.photoUrl, role: m.roleLabel ?? "", showRole: m.showRole, bookable: m.isBookable })),
  };
}

async function form() {
  const ctx = await needCtx();
  const rows = await db.select().from(formQuestions).where(eq(formQuestions.businessId, ctx.business.id)).orderBy(asc(formQuestions.position));
  const plan = (await effectivePlan(ctx.business.id)).plan;
  return {
    form: {
      active: rows.length > 0,
      questions: rows.map((q) => ({ id: q.id, label: q.label, type: q.type, required: q.isRequired, options: q.options, order: q.position })),
      maxQuestions: limitOf(plan, "formQuestions"),
    },
  };
}

export const catalogRoutes: Route[] = [
  {
    method: "GET",
    path: "/services",
    handler: async (r) => {
      const ctx = await needCtx("services.view");
      return { services: await serviceDtos(ctx.business.id, { includeInactive: r.query.get("includeInactive") === "1" }) };
    },
  },
  { method: "POST", path: "/services", handler: (r) => save(r, null) },
  {
    method: "PATCH",
    path: "/services/:id",
    handler: (r) => (uuid(r.params.id!) ? save(r, r.params.id!) : fail(404, "not_found", "Prestation introuvable.")),
  },
  {
    method: "PATCH",
    path: "/services/:id/toggle",
    handler: async (r) => {
      const ctx = await needCtx("services.manage");
      if (!uuid(r.params.id!)) return fail(404, "not_found", "Prestation introuvable.");
      const before = await serviceDto(ctx.business.id, r.params.id!);
      await toggleService(before.id, !before.active);
      const after = await serviceDto(ctx.business.id, before.id);
      if (after.active === before.active) return fail(403, "plan_limit", "Votre forfait ne permet pas plus de prestations actives. Masquez-en une ou changez de forfait sur le site.");
      return { service: after };
    },
  },
  {
    method: "DELETE",
    path: "/services/:id",
    handler: async (r) => {
      await needCtx("services.manage");
      if (!uuid(r.params.id!)) return fail(404, "not_found", "Prestation introuvable.");
      try {
        const res = await deleteService(r.params.id!);
        ensureOk(res);
      } catch (e) {
        if (!isRedirect(e)) throw e;
      }
      return { ok: true, id: r.params.id };
    },
  },
  { method: "GET", path: "/team", handler: team },
  { method: "GET", path: "/forms", handler: form },
  {
    method: "PUT",
    path: "/forms",
    handler: async (r) => {
      await needCtx("forms.manage");
      const list = Array.isArray(r.body.questions) ? (r.body.questions as Record<string, unknown>[]) : [];
      // « Désactiver » le formulaire = ne plus poser de question.
      const questions = bool(r.body.active ?? true)
        ? list.map((q) => ({ label: str(q.label, 200), type: ["text", "choice", "yes_no"].includes(String(q.type)) ? q.type : "text", isRequired: bool(q.required), options: Array.isArray(q.options) ? (q.options as unknown[]).map((o) => str(o, 80)).filter(Boolean) : [] }))
        : [];
      ensureOk(await saveFormQuestions(questions));
      return form();
    },
  },
];
