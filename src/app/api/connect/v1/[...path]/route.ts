import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { z } from "@/lib/zod";
import { recordError } from "@/server/health";
import { getAvailableSlots } from "@/server/availability";
import { bookPublic } from "@/server/booking-core";
import { ConnectError, authenticate } from "@/server/connect";
import { recordContact } from "@/server/contact-messages";
import { getPublicBusiness } from "@/server/public";
import { shopOrigin } from "@/server/shop";

/**
 * API des sites connectés (sites sur mesure) : appelée par le serveur du site du pro avec sa clé secrète.
 * Documentation : /developpeurs. Réponses : `{ data }` ou `{ error: { code, message } }`.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
const err = (status: number, code: string, message: string) => json({ error: { code, message } }, status);
const origin = () => shopOrigin();
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function body(req: Request) {
  const text = await req.text();
  if (text.length > 20_000) throw new ConnectError(413, "too_large", "Requête trop volumineuse (20 Ko maximum).");
  try { return text ? (JSON.parse(text) as Record<string, unknown>) : {}; } catch { throw new ConnectError(400, "invalid_json", "Corps JSON invalide."); }
}

const bookingSchema = z.object({
  serviceId: z.uuid(),
  memberId: z.uuid().nullable().optional(),
  date: isoDay,
  time: z.string().regex(/^\d{2}:\d{2}$/),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.email(),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().max(1000).optional(),
  acceptPolicy: z.boolean().optional(),
  locale: z.enum(["fr", "nl", "en", "de", "es", "it"]).optional(),
});
const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.union([z.literal(""), z.email()]).optional(),
  phone: z.string().trim().max(40).optional(),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1).max(5000),
  pageUrl: z.string().trim().max(500).optional(),
});

async function handle(req: Request, { params }: Ctx) {
  const path = (await params).path.join("/");
  const route = `${req.method} ${path}`;
  try {
    switch (route) {
      case "GET business": {
        const k = await authenticate(req, "business");
        const d = await getPublicBusiness(k.slug);
        if (!d) throw new ConnectError(404, "not_found", "Entreprise introuvable.");
        const b = d.business;
        return json({ data: { name: b.name, type: b.businessType, phone: b.phone, email: b.email, website: b.website, address: b.address, postalCode: b.postalCode, city: b.city, country: b.country, hours: d.hours, bookingUrl: `${origin()}/${b.slug}`, shopUrl: `${origin()}/boutique/${b.slug}` } });
      }
      case "GET services": {
        const k = await authenticate(req, "rdv");
        const d = await getPublicBusiness(k.slug);
        if (!d) throw new ConnectError(404, "not_found", "Entreprise introuvable.");
        return json({ data: { bookingOpen: !d.closed, onlinePaymentRequired: d.payment.required, services: d.services.filter((s) => s.kind !== "group").map((s) => ({ id: s.id, name: s.name, description: s.description, durationMin: s.durationMin, durationMaxMin: s.durationMaxMin, priceCents: s.priceCents, imageUrl: s.imageUrl, memberIds: s.memberIds })), team: d.team.map((m) => ({ id: m.id, name: m.name, role: m.role, photoUrl: m.photoUrl })) } });
      }
      case "GET slots": {
        const k = await authenticate(req, "rdv");
        const q = new URL(req.url).searchParams;
        const v = z.object({ serviceId: z.uuid(), memberId: z.uuid().nullable(), from: isoDay, days: z.number().int().min(1).max(14) }).safeParse({ serviceId: q.get("serviceId"), memberId: q.get("memberId") || null, from: q.get("from") ?? new Date().toISOString().slice(0, 10), days: Number(q.get("days") ?? 7) });
        if (!v.success) throw new ConnectError(400, "invalid", "Paramètres : serviceId (obligatoire), from=AAAA-MM-JJ, days=1 à 14, memberId (facultatif).");
        const d = await getPublicBusiness(k.slug);
        const service = d?.services.find((s) => s.id === v.data.serviceId);
        if (!d || !service || (v.data.memberId && !service.memberIds.includes(v.data.memberId))) throw new ConnectError(404, "not_found", "Prestation introuvable.");
        if (d.closed) return json({ data: { bookingOpen: false, days: [] } });
        const days: string[] = [];
        const start = new Date(`${v.data.from}T12:00:00Z`);
        for (let i = 0; i < v.data.days; i++) { const x = new Date(start); x.setUTCDate(x.getUTCDate() + i); days.push(x.toISOString().slice(0, 10)); }
        const slots = await getAvailableSlots({ businessId: d.business.id, serviceId: service.id, memberId: v.data.memberId ?? undefined, days });
        return json({ data: { bookingOpen: true, days: days.map((date) => ({ date, slots: (slots[date] ?? []).map((s) => ({ time: s.time, memberIds: s.memberIds })) })) } });
      }
      case "POST bookings": {
        const k = await authenticate(req, "rdv");
        if (k.locked) throw new ConnectError(402, "subscription_required", "L'abonnement Skydev de cette entreprise n'est pas actif : les réservations sont fermées.");
        const v = bookingSchema.safeParse(await body(req));
        if (!v.success) throw new ConnectError(400, "invalid", `Champ invalide : ${v.error.issues[0]?.path.join(".")} (${v.error.issues[0]?.message}).`);
        const r = await bookPublic({ ...v.data, slug: k.slug, memberId: v.data.memberId ?? null, phone: v.data.phone ?? "", message: v.data.message ?? "", answers: {}, paymentMethod: "none" }, { ip: "api", source: "api" });
        if (!r.ok) return json({ error: { code: r.slotTaken ? "slot_taken" : "refused", message: r.error, fields: r.fieldErrors ?? undefined } }, r.slotTaken ? 409 : 422);
        return json({ data: { manageUrl: `${origin()}/r/${r.token}` } }, 201);
      }
      case "POST contacts": {
        const k = await authenticate(req, "contacts");
        const v = contactSchema.safeParse(await body(req));
        if (!v.success) throw new ConnectError(400, "invalid", `Champ invalide : ${v.error.issues[0]?.path.join(".")} (${v.error.issues[0]?.message}).`);
        if (!v.data.email && !v.data.phone) throw new ConnectError(400, "invalid", "Indiquez un email ou un téléphone pour pouvoir répondre.");
        const r = await recordContact(k.businessId, { name: v.data.name, email: v.data.email || null, phone: v.data.phone || null, subject: v.data.subject || null, message: v.data.message, pageUrl: v.data.pageUrl || null }, "api");
        if (!r) throw new ConnectError(404, "not_found", "Entreprise introuvable.");
        return json({ data: { id: r.id } }, 201);
      }
      case "GET products": {
        const k = await authenticate(req, "shop");
        const rows = await db
          .select({ id: products.id, name: products.name, description: products.description, category: products.category, priceCents: products.priceCents, photoUrl: products.photoUrl, trackStock: products.trackStock, stockQty: products.stockQty, isModel: products.isModel, parentId: products.parentId, size: products.size, color: products.color })
          .from(products)
          .where(and(eq(products.businessId, k.businessId), eq(products.active, true), eq(products.onlineEnabled, true)))
          .orderBy(asc(products.category), asc(products.name));
        const inStock = (p: (typeof rows)[number]) => (p.trackStock ? Math.max(0, p.stockQty) : null);
        const list = rows.filter((p) => !p.parentId).map((p) => ({
          id: p.id, name: p.name, description: p.description, category: p.category, priceCents: p.priceCents, photoUrl: p.photoUrl,
          ...(p.isModel ? { variants: rows.filter((v) => v.parentId === p.id).map((v) => ({ id: v.id, size: v.size, color: v.color, stock: inStock(v) })) } : { stock: inStock(p) }),
        }));
        return json({ data: { shopUrl: `${origin()}/boutique/${k.slug}`, products: list } });
      }
      case "GET reviews": {
        const k = await authenticate(req, "reviews");
        const d = await getPublicBusiness(k.slug);
        if (!d) throw new ConnectError(404, "not_found", "Entreprise introuvable.");
        return json({ data: { count: d.reviews.count, average: d.reviews.average ? Math.round(d.reviews.average * 10) / 10 : null, items: d.reviews.items.map((r) => ({ author: r.author.split(" ")[0], rating: r.rating, comment: r.comment, createdAt: r.createdAt })) } });
      }
      default:
        return err(404, "not_found", "Route inconnue. Voir la documentation : /developpeurs");
    }
  } catch (e) {
    if (e instanceof ConnectError) return err(e.status, e.code, e.message);
    await recordError({ source: "server", message: `API sites connectés : ${e instanceof Error ? e.message : String(e)}`, detail: e instanceof Error ? e.stack : null, path: `/api/connect/v1/${path}` }).catch(() => {});
    return err(500, "server_error", "Erreur interne. Réessayez plus tard.");
  }
}

export const GET = handle;
export const POST = handle;
