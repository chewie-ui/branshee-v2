import "server-only";
import { headers } from "next/headers";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { addInterventionPhoto, deleteIntervention, invoiceIntervention, removeInterventionPhoto, saveIntervention, saveInterventionWork, setInterventionStatus, signIntervention } from "@/server/actions/interventions";
import { fail, forbidden, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { currentContext, type AppContext } from "@/server/context";
import { canWork, interventionOf, interventionRights, listInterventions } from "@/server/interventions";
import { isLocked } from "@/server/plan";
import { teamOf } from "@/server/projects";
import { readPrivateFile, sniffImage } from "@/server/storage";

/** API mobile de l'app Interventions (Skydev) : planning terrain, statut, rapport, fournitures, photos, signature, facture. */

async function needInterventions(): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("interventions")) return forbidden();
  const method = (await headers()).get("x-method") ?? "POST";
  if (method !== "GET" && (await isLocked(ctx.business.id, ctx.business.brand))) return fail(402, "read_only", "Votre essai est terminé : abonnez-vous pour continuer à modifier.");
  return ctx;
}

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const ok = <T extends { ok: boolean }>(r: T) => {
  const e = r as { ok: boolean; error?: string };
  if (!e.ok) return invalid(e.error ?? "Action impossible.");
  return r as T & { id?: string; message?: string; url?: string };
};
const msg = (r: { message?: string }) => ({ ok: true, message: r.message ?? null });

async function customersOf(ctx: AppContext) {
  if (!interventionRights(ctx).manage) return [];
  const rows = await db.select({ id: customers.id, name: customers.fullName, company: customers.companyName }).from(customers).where(eq(customers.businessId, ctx.business.id)).orderBy(asc(customers.fullName)).limit(3000);
  return rows.map((c) => ({ id: c.id, name: c.company ? `${c.company} (${c.name})` : c.name }));
}

function input(b: Record<string, unknown>, id?: string) {
  const at = str(b.scheduledAt, 40);
  return {
    id,
    customerId: uuid(b.customerId) ? (b.customerId as string) : "",
    clientName: str(b.clientName, 120),
    clientPhone: str(b.clientPhone, 40),
    clientEmail: str(b.clientEmail, 200),
    address: str(b.address, 300),
    title: str(b.title, 160),
    description: str(b.description, 4000),
    technicianId: uuid(b.technicianId) ? (b.technicianId as string) : "",
    scheduledAt: at && !Number.isNaN(Date.parse(at)) ? new Date(at).toISOString() : "",
    durationMinutes: Math.round(Number(b.durationMinutes) || 60),
  };
}

async function list(r: ApiRequest) {
  const ctx = await needInterventions();
  const rights = interventionRights(ctx);
  const v = r.query.get("view");
  const view = v === "done" ? "done" : v === "mine" ? "mine" : "todo";
  const [rows, team, clients] = await Promise.all([
    view === "done" ? listInterventions(ctx.business.id, {}) : listInterventions(ctx.business.id, { done: false, technicianId: view === "mine" ? ctx.member.id : undefined }),
    teamOf(ctx.business.id),
    customersOf(ctx),
  ]);
  const shown = view === "done" ? rows.filter((x) => x.i.status === "done" || x.i.status === "cancelled") : rows.filter((x) => x.i.status !== "cancelled");
  return {
    view,
    me: ctx.member.id,
    canManage: rights.manage,
    team,
    customers: clients,
    interventions: shown.map(({ i, tech }) => ({ id: i.id, number: i.number, title: i.title, client: i.clientName, address: i.address, status: i.status, scheduledAt: i.scheduledAt?.toISOString() ?? null, durationMinutes: i.durationMinutes, tech, techId: i.technicianId, signed: !!i.signedAt, invoiced: !!i.invoiceId })),
  };
}

async function detail(r: ApiRequest) {
  const ctx = await needInterventions();
  const x = await interventionOf(ctx.business.id, r.params.id!);
  if (!x) return fail(404, "not_found", "Intervention introuvable.");
  const rights = interventionRights(ctx);
  const [team, clients] = await Promise.all([teamOf(ctx.business.id), customersOf(ctx)]);
  const i = x.i;
  return {
    intervention: { id: i.id, number: i.number, title: i.title, description: i.description, clientName: i.clientName, clientPhone: i.clientPhone, clientEmail: i.clientEmail, address: i.address, customerId: i.customerId, status: i.status, scheduledAt: i.scheduledAt?.toISOString() ?? null, durationMinutes: i.durationMinutes, tech: x.tech, technicianId: i.technicianId, report: i.report ?? "", items: i.items, laborMinutes: i.laborMinutes, startedAt: i.startedAt?.toISOString() ?? null, finishedAt: i.finishedAt?.toISOString() ?? null, photos: i.photos.map((p) => ({ ref: p.ref, kind: p.kind, name: p.name })), signerName: i.signerName, signaturePath: i.signaturePath, signedAt: i.signedAt?.toISOString() ?? null, invoiceId: i.invoiceId },
    canWork: canWork(ctx, i),
    canManage: rights.manage,
    canInvoice: rights.manage && ctx.can("invoices.manage"),
    team,
    customers: clients,
  };
}

async function photo(r: ApiRequest) {
  const ctx = await needInterventions();
  const x = await interventionOf(ctx.business.id, r.params.id!);
  const p = x?.i.photos.find((y) => y.ref === r.query.get("ref"));
  if (!p) return fail(404, "not_found", "Photo introuvable.");
  const data = await readPrivateFile(p.ref).catch(() => null);
  const type = data ? sniffImage(data) : null;
  if (!data || !type) return fail(404, "not_found", "Photo introuvable.");
  return new Response(new Uint8Array(data), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}

export const interventionsRoutes: Route[] = [
  { method: "GET", path: "/interventions", handler: list },
  {
    method: "POST",
    path: "/interventions",
    handler: async (r) => {
      await needInterventions();
      const res = ok(await saveIntervention(input(r.body)));
      return { ok: true, id: res.id ?? null };
    },
  },
  { method: "GET", path: "/interventions/:id", handler: detail },
  {
    method: "PATCH",
    path: "/interventions/:id",
    handler: async (r) => {
      await needInterventions();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Intervention introuvable.");
      return msg(ok(await saveIntervention(input(r.body, r.params.id!))));
    },
  },
  {
    method: "DELETE",
    path: "/interventions/:id",
    handler: async (r) => {
      await needInterventions();
      return msg(ok(await deleteIntervention(r.params.id!)));
    },
  },
  {
    method: "POST",
    path: "/interventions/:id/status",
    handler: async (r) => {
      await needInterventions();
      return msg(ok(await setInterventionStatus(r.params.id!, str(r.body.status, 20))));
    },
  },
  {
    method: "PATCH",
    path: "/interventions/:id/work",
    handler: async (r) => {
      await needInterventions();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Intervention introuvable.");
      const items = Array.isArray(r.body.items)
        ? (r.body.items as Record<string, unknown>[]).map((it) => ({ name: str(it?.name, 160), qty: Number(it?.qty) || 0, unitCents: Math.round(Number(it?.unitCents) || 0), vatRate: Number(it?.vatRate ?? 21) }))
        : [];
      return msg(ok(await saveInterventionWork({ id: r.params.id!, report: str(r.body.report, 8000), items })));
    },
  },
  { method: "GET", path: "/interventions/:id/photo", handler: photo },
  {
    method: "POST",
    path: "/interventions/:id/photos",
    handler: async (r) => {
      await needInterventions();
      const b64 = typeof r.body.base64 === "string" ? r.body.base64.replace(/^data:[^,]*,/, "") : "";
      if (!b64 || b64.length > 14 * 1024 * 1024) return invalid("Photo trop lourde (10 Mo maximum).");
      const fd = new FormData();
      fd.set("id", r.params.id!);
      fd.set("kind", r.body.kind === "after" ? "after" : "before");
      fd.set("photo", new File([Buffer.from(b64, "base64")], str(r.body.name, 120) || "photo.jpg"));
      return msg(ok(await addInterventionPhoto(fd)));
    },
  },
  {
    method: "DELETE",
    path: "/interventions/:id/photos",
    handler: async (r) => {
      await needInterventions();
      return msg(ok(await removeInterventionPhoto(r.params.id!, str(r.body.ref ?? r.query.get("ref"), 200))));
    },
  },
  {
    method: "POST",
    path: "/interventions/:id/sign",
    handler: async (r) => {
      await needInterventions();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Intervention introuvable.");
      return msg(ok(await signIntervention({ id: r.params.id!, name: str(r.body.name, 120), path: str(r.body.path, 40_000) })));
    },
  },
  {
    method: "POST",
    path: "/interventions/:id/invoice",
    handler: async (r) => {
      await needInterventions();
      const res = ok(await invoiceIntervention(r.params.id!));
      return { ok: true, message: res.message ?? null, invoiceId: res.url?.split("/").pop() ?? null };
    },
  },
];
