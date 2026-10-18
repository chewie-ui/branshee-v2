import "server-only";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, customerNotes, customers } from "@/db/schema";
import { decrypt } from "@/lib/field-crypto";
import { readPrivateFile } from "@/server/storage";
import { deleteNote, saveAltContacts, saveGeneralInfo, saveNote, setCustomerBlocked } from "@/server/actions/customers";
import { bool, ensureOk, fail, formData, has, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { dayOf, isDay, loadBookings, needCtx, splitName, timeOf } from "@/server/api/v1/shared";

const uuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

async function ownCustomer(businessId: string, id: string) {
  if (!uuid(id)) return fail(404, "not_found", "Fiche introuvable.");
  const [c] = await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.businessId, businessId)));
  return c ?? fail(404, "not_found", "Fiche introuvable.");
}

async function list(r: ApiRequest) {
  const ctx = await needCtx("customers.view");
  const tz = ctx.business.timezone;
  const q = str(r.query.get("search"), 80);
  const where = [eq(customers.businessId, ctx.business.id)];
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(customers.fullName, like), ilike(customers.email, like), ilike(customers.phone, like), ilike(customers.altName, like))!);
  }
  const rows = await db.select().from(customers).where(and(...where)).orderBy(desc(customers.updatedAt)).limit(300);
  const ids = rows.map((c) => c.id);
  const stats = ids.length ? await db.select({ id: appointments.customerId, n: count() }).from(appointments).where(and(inArray(appointments.customerId, ids), eq(appointments.kind, "appointment"))).groupBy(appointments.customerId) : [];
  type Last = { customerId: string; startsAt: string | Date; status: string; noShow: boolean; memberName: string | null };
  const lastRows: Last[] = ids.length
    ? [
        ...(await db.execute<Last>(sql`
        select distinct on (a.customer_id) a.customer_id as "customerId", a.starts_at as "startsAt", a.status, a.no_show as "noShow", m.display_name as "memberName"
        from appointments a left join members m on m.id = a.member_id
        where a.customer_id in ${ids} and a.kind = 'appointment'
        order by a.customer_id, a.starts_at desc`)),
      ]
    : [];
  const clients = rows
    .map((c) => {
      const l = lastRows.find((x) => x.customerId === c.id);
      const when = l ? new Date(l.startsAt) : null;
      const names = c.firstName || c.lastName ? { firstName: c.firstName ?? "", lastName: c.lastName ?? "" } : splitName(c.fullName);
      return {
        id: c.id,
        name: names.firstName,
        surname: names.lastName,
        fullName: c.fullName,
        email: c.email ?? "",
        phone: c.phone ?? "",
        count: stats.find((s) => s.id === c.id)?.n ?? 0,
        lastDate: when ? dayOf(when, tz) : "",
        lastTime: when ? timeOf(when, tz) : "",
        lastState: (l?.noShow ? "noshow" : l?.status === "cancelled" ? "canceled" : "confirmed") as "confirmed" | "canceled" | "noshow",
        employeeName: l?.memberName ?? "",
        altName: c.altName ?? "",
        blocked: !!c.blockedAt,
        _sort: when?.getTime() ?? 0,
      };
    })
    .sort((a, b) => b._sort - a._sort)
    .map(({ _sort, ...c }) => (void _sort, c));
  return { count: clients.length, clients };
}

function entryDto(n: typeof customerNotes.$inferSelect) {
  return { id: n.id, date: n.date, title: n.title ?? "", note: decrypt(n.noteEnc) ?? "", todo: decrypt(n.todoEnc) ?? "", hasAttachment: !!n.attachmentPath, attachmentName: n.attachmentName ?? "" };
}

async function detail(r: ApiRequest) {
  const ctx = await needCtx("customers.view");
  const c = await ownCustomer(ctx.business.id, r.params.id!);
  const bookings = (await loadBookings([eq(appointments.customerId, c.id), eq(appointments.businessId, ctx.business.id)], ctx.business.timezone)).reverse();
  const notes = await db.select().from(customerNotes).where(eq(customerNotes.customerId, c.id)).orderBy(desc(customerNotes.date), desc(customerNotes.createdAt));
  const names = c.firstName || c.lastName ? { firstName: c.firstName ?? "", lastName: c.lastName ?? "" } : splitName(c.fullName);
  const individual = bookings.filter((b) => !b.isBlock);
  return {
    client: {
      id: c.id,
      name: names.firstName,
      surname: names.lastName,
      fullName: c.fullName,
      email: c.email ?? "",
      phone: c.phone ?? "",
      altName: c.altName ?? "",
      altEmail: c.altEmail ?? "",
      altPhone: c.altPhone ?? "",
      generalInfo: decrypt(c.generalInfoEnc) ?? "",
      blocked: !!c.blockedAt,
      blockedReason: c.blockedReason ?? "",
      totalBookings: individual.length,
      confirmedBookings: individual.filter((b) => b.status === "confirmed" && !b.noShow).length,
      noShows: individual.filter((b) => b.noShow).length,
    },
    bookings,
    entries: notes.map(entryDto),
  };
}

async function update(r: ApiRequest) {
  const ctx = await needCtx("customers.manage");
  const c = await ownCustomer(ctx.business.id, r.params.id!);
  const b = r.body;
  if (has(b, "altName") || has(b, "altEmail") || has(b, "altPhone")) {
    ensureOk(await saveAltContacts(c.id, undefined, formData({ altName: has(b, "altName") ? str(b.altName, 120) : (c.altName ?? ""), altEmail: has(b, "altEmail") ? str(b.altEmail, 200) : (c.altEmail ?? ""), altPhone: has(b, "altPhone") ? str(b.altPhone, 40) : (c.altPhone ?? "") })));
  }
  if (has(b, "generalInfo")) ensureOk(await saveGeneralInfo(c.id, str(b.generalInfo, 5000)));
  const [n] = await db.select().from(customers).where(eq(customers.id, c.id));
  return { ok: true, client: { altName: n!.altName ?? "", altEmail: n!.altEmail ?? "", altPhone: n!.altPhone ?? "", generalInfo: decrypt(n!.generalInfoEnc) ?? "" } };
}

async function saveEntry(r: ApiRequest, entryId: string | null) {
  const ctx = await needCtx("customers.manage");
  const c = await ownCustomer(ctx.business.id, r.params.id!);
  const b = r.body;
  let current: typeof customerNotes.$inferSelect | null = null;
  if (entryId) {
    if (!uuid(entryId)) return fail(404, "not_found", "Note introuvable.");
    [current] = await db.select().from(customerNotes).where(and(eq(customerNotes.id, entryId), eq(customerNotes.customerId, c.id)));
    if (!current) return fail(404, "not_found", "Note introuvable.");
  }
  const date = has(b, "date") ? b.date : (current?.date ?? new Date().toISOString().slice(0, 10));
  if (!isDay(date)) return invalid("Date invalide.", { field: "date" });
  const pick = (k: "title" | "note" | "todo", prev: string) => (has(b, k) ? str(b[k], k === "title" ? 200 : 20000) : prev);
  const prev = current ? entryDto(current) : { title: "", note: "", todo: "" };
  // La pièce jointe éventuelle n'est jamais touchée : aucun champ fichier n'est envoyé.
  ensureOk(await saveNote(c.id, entryId, formData({ date, title: pick("title", prev.title), note: pick("note", prev.note), todo: pick("todo", prev.todo) })));
  const [saved] = entryId
    ? await db.select().from(customerNotes).where(eq(customerNotes.id, entryId))
    : await db.select().from(customerNotes).where(and(eq(customerNotes.customerId, c.id), eq(customerNotes.authorMemberId, ctx.member.id))).orderBy(desc(customerNotes.createdAt)).limit(1);
  return { ok: true, entry: entryDto(saved!) };
}

async function file(r: ApiRequest) {
  const ctx = await needCtx("customers.view");
  const c = await ownCustomer(ctx.business.id, r.params.id!);
  if (!uuid(r.params.entryId!)) return fail(404, "not_found", "Pièce jointe introuvable.");
  const [row] = await db.select({ path: customerNotes.attachmentPath, name: customerNotes.attachmentName }).from(customerNotes).where(and(eq(customerNotes.id, r.params.entryId!), eq(customerNotes.customerId, c.id)));
  if (!row?.path) return fail(404, "not_found", "Pièce jointe introuvable.");
  let data: Buffer;
  try {
    data = await readPrivateFile(row.path);
  } catch {
    return fail(404, "not_found", "Fichier introuvable sur le serveur.");
  }
  const filename = (row.name ?? "document.pdf").replace(/["\\\r\n]/g, "");
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export const clientRoutes: Route[] = [
  { method: "GET", path: "/clients", handler: list },
  { method: "GET", path: "/clients/:id", handler: detail },
  { method: "PATCH", path: "/clients/:id", handler: update },
  {
    method: "PATCH",
    path: "/clients/:id/block",
    handler: async (r) => {
      const ctx = await needCtx("customers.manage");
      const c = await ownCustomer(ctx.business.id, r.params.id!);
      const blocked = bool(r.body.blocked);
      const reason = str(r.body.reason, 200);
      ensureOk(await setCustomerBlocked(c.id, blocked, reason));
      return { ok: true, blocked, blockedReason: blocked ? reason : "" };
    },
  },
  { method: "POST", path: "/clients/:id/dossier/entries", handler: (r) => saveEntry(r, null) },
  { method: "PATCH", path: "/clients/:id/dossier/entries/:entryId", handler: (r) => saveEntry(r, r.params.entryId!) },
  {
    method: "DELETE",
    path: "/clients/:id/dossier/entries/:entryId",
    handler: async (r) => {
      const ctx = await needCtx("customers.manage");
      const c = await ownCustomer(ctx.business.id, r.params.id!);
      if (!uuid(r.params.entryId!)) return fail(404, "not_found", "Note introuvable.");
      ensureOk(await deleteNote(c.id, r.params.entryId!));
      return { ok: true, id: r.params.entryId };
    },
  },
  { method: "GET", path: "/clients/:id/dossier/entries/:entryId/file", handler: file },
];

