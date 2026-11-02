"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { activityLogs, vehicles } from "@/db/schema";
import { BODY_TYPES, EURO_NORMS, FUELS, GEARBOXES, cleanEquipment, isVehicleStatus, isVin, parseCarPrice, vehicleFullTitle, vehicleSlug } from "@/lib/vehicles";
import { requireContext } from "@/server/context";
import { deletePublicImage, savePublicImage } from "@/server/storage";
import { vehicleOf, vehicleRights } from "@/server/vehicles";

type Result = { ok: true; message?: string; id?: string } | { ok: false; error: string };
const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };
const MAX_PHOTOS = 30;
const refresh = (id?: string) => {
  revalidatePath("/app/vehicules", "layout");
  if (id) revalidatePath(`/app/vehicules/${id}`);
};

const intOrNull = (max: number, msg: string) =>
  z.string().trim().transform((v, c) => {
    if (!v) return null;
    const n = Number(v.replace(/[\s. ]/g, ""));
    if (!Number.isInteger(n) || n < 0 || n > max) { c.addIssue({ code: "custom", message: msg }); return z.NEVER; }
    return n;
  });
const euroOrNull = (msg: string) =>
  z.string().trim().transform((v, c) => {
    if (!v) return null;
    const n = parseCarPrice(v);
    if (n === null || n > 100_000_000_00) { c.addIssue({ code: "custom", message: msg }); return z.NEVER; }
    return n;
  });
const oneOf = (keys: readonly string[]) => z.string().trim().transform((v) => (keys.includes(v) ? v : null));
const opt = (max: number) => z.string().trim().max(max).transform((v) => v || null);

const vehicleSchema = z.object({
  make: z.string().trim().min(1, "Indiquez la marque.").max(40),
  model: z.string().trim().min(1, "Indiquez le modèle.").max(60),
  version: opt(80),
  bodyType: oneOf(Object.keys(BODY_TYPES)),
  fuel: oneOf(Object.keys(FUELS)),
  gearbox: oneOf(Object.keys(GEARBOXES)),
  firstRegistration: z.string().trim().transform((v, c) => {
    if (!v) return null;
    const m = /^(\d{4})-(\d{2})$/.exec(v);
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 12 || Number(m[1]) < 1900 || Number(m[1]) > new Date().getFullYear() + 1) { c.addIssue({ code: "custom", message: "Date de 1re immatriculation invalide." }); return z.NEVER; }
    return v;
  }),
  mileageKm: intOrNull(2_000_000, "Kilométrage invalide."),
  powerKw: intOrNull(2000, "Puissance invalide (en kW)."),
  engineCc: intOrNull(20000, "Cylindrée invalide."),
  co2: intOrNull(1000, "CO₂ invalide."),
  euroNorm: oneOf(EURO_NORMS),
  color: opt(40),
  interior: opt(60),
  doors: intOrNull(9, "Nombre de portes invalide."),
  seats: intOrNull(60, "Nombre de places invalide."),
  owners: intOrNull(20, "Nombre de propriétaires invalide."),
  price: euroOrNull("Prix invalide."),
  vatMode: z.enum(["margin", "vat"]).catch("margin"),
  warrantyMonths: intOrNull(120, "Garantie invalide (en mois)."),
  carPass: z.literal("1").optional(),
  serviceHistory: z.literal("1").optional(),
  equipment: z.string().max(5000).transform((v) => cleanEquipment(v.split("\n"))),
  description: opt(5000),
  vin: z.string().trim().max(17).transform((v, c) => {
    if (!v) return null;
    if (!isVin(v)) { c.addIssue({ code: "custom", message: "Numéro de châssis (VIN) : 17 caractères, sans I, O ni Q." }); return z.NEVER; }
    return v.toUpperCase();
  }),
  plate: opt(20),
  purchase: euroOrNull("Prix d'achat invalide."),
  internalNote: opt(2000),
  status: z.string().transform((v) => (isVehicleStatus(v) ? v : "draft")),
});

/** Créer ou modifier une fiche véhicule (les photos se gèrent à part, une par une). */
export async function saveVehicle(id: string | null, fd: FormData): Promise<Result> {
  const ctx = await requireContext(undefined, { app: "vehicules" });
  if (ctx.impersonating) return SUPERVISION;
  if (!vehicleRights(ctx).manage) return { ok: false, error: "Seul le responsable modifie les véhicules." };
  const current = id ? await vehicleOf(ctx.business.id, id) : null;
  if (id && !current) return { ok: false, error: "Véhicule introuvable." };
  const raw = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));
  const defaults = { version: "", bodyType: "", fuel: "", gearbox: "", firstRegistration: "", mileageKm: "", powerKw: "", engineCc: "", co2: "", euroNorm: "", color: "", interior: "", doors: "", seats: "", owners: "", price: "", vatMode: "margin", warrantyMonths: "", equipment: "", description: "", vin: "", plate: "", purchase: "", internalNote: "", status: current?.status ?? "draft" };
  const v = vehicleSchema.safeParse({ ...defaults, ...raw });
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les champs." };
  const d = v.data;

  const values = {
    make: d.make, model: d.model, version: d.version, bodyType: d.bodyType, fuel: d.fuel, gearbox: d.gearbox, firstRegistration: d.firstRegistration,
    mileageKm: d.mileageKm, powerKw: d.powerKw, engineCc: d.engineCc, co2: d.co2, euroNorm: d.euroNorm, color: d.color, interior: d.interior,
    doors: d.doors, seats: d.seats, owners: d.owners, priceCents: d.price, vatMode: d.vatMode, warrantyMonths: d.warrantyMonths,
    carPass: !!d.carPass, serviceHistory: !!d.serviceHistory, equipment: d.equipment, description: d.description,
    vin: d.vin, plate: d.plate, purchaseCents: d.purchase, internalNote: d.internalNote,
    status: d.status,
    publishedAt: d.status === "for_sale" || d.status === "reserved" ? (current?.publishedAt ?? new Date()) : (current?.publishedAt ?? null),
    soldAt: d.status === "sold" ? (current?.soldAt ?? new Date()) : null,
    updatedAt: new Date(),
  };

  let savedId = id;
  if (current) {
    await db.update(vehicles).set(values).where(and(eq(vehicles.id, current.id), eq(vehicles.businessId, ctx.business.id)));
  } else {
    const existing = await db.select({ slug: vehicles.slug }).from(vehicles).where(eq(vehicles.businessId, ctx.business.id));
    const taken = new Set(existing.map((e) => e.slug));
    const slug = vehicleSlug(d, (s) => taken.has(s));
    const [row] = await db.insert(vehicles).values({ ...values, businessId: ctx.business.id, slug }).returning({ id: vehicles.id });
    savedId = row!.id;
  }
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: current ? "vehicle.update" : "vehicle.create", description: `${current ? "Véhicule modifié" : "Véhicule ajouté"} : ${vehicleFullTitle(d)}` });
  refresh(savedId ?? undefined);
  return { ok: true, id: savedId ?? undefined, message: current ? "Véhicule enregistré." : "Véhicule ajouté." };
}

type Fail = { ok: false; error: string };
async function manageable(id: string): Promise<{ error: Fail } | { ctx: Awaited<ReturnType<typeof requireContext>>; v: NonNullable<Awaited<ReturnType<typeof vehicleOf>>> }> {
  const ctx = await requireContext(undefined, { app: "vehicules" });
  if (ctx.impersonating) return { error: SUPERVISION };
  if (!vehicleRights(ctx).manage) return { error: { ok: false, error: "Seul le responsable modifie les véhicules." } };
  const v = await vehicleOf(ctx.business.id, z.uuid().parse(id));
  if (!v) return { error: { ok: false, error: "Véhicule introuvable." } };
  return { ctx, v };
}

/** Ajouter une photo (envoyée seule, déjà réduite par le navigateur) à la fin de la galerie. */
export async function addVehiclePhoto(id: string, fd: FormData): Promise<Result & { url?: string }> {
  const m = await manageable(id);
  if ("error" in m) return m.error;
  if (m.v.photos.length >= MAX_PHOTOS) return { ok: false, error: `${MAX_PHOTOS} photos maximum par véhicule.` };
  const f = fd.get("photo");
  if (!(f instanceof File) || f.size === 0) return { ok: false, error: "Aucune photo reçue." };
  if (f.size > 8 * 1024 * 1024) return { ok: false, error: "Photo trop lourde (8 Mo maximum)." };
  let url: string;
  try { url = await savePublicImage(Buffer.from(await f.arrayBuffer())); } catch { return { ok: false, error: "Photo : JPG, PNG, WebP ou GIF." }; }
  // Ajout atomique (deux envois en parallèle ne s'écrasent pas).
  await db.execute(sql`update vehicles set photos = array_append(photos, ${url}), updated_at = now() where id = ${m.v.id} and business_id = ${m.ctx.business.id}`);
  refresh(m.v.id);
  return { ok: true, url };
}

/** Retirer une photo (fichier supprimé). */
export async function removeVehiclePhoto(id: string, url: string): Promise<Result> {
  const m = await manageable(id);
  if ("error" in m) return m.error;
  if (!m.v.photos.includes(url)) return { ok: false, error: "Photo introuvable." };
  await db.execute(sql`update vehicles set photos = array_remove(photos, ${url}), updated_at = now() where id = ${m.v.id} and business_id = ${m.ctx.business.id}`);
  await deletePublicImage(url);
  refresh(m.v.id);
  return { ok: true };
}

/** Nouvel ordre des photos (la première devient la photo principale). Seules les photos du véhicule sont acceptées. */
export async function reorderVehiclePhotos(id: string, order: string[]): Promise<Result> {
  const m = await manageable(id);
  if ("error" in m) return m.error;
  const owned = new Set(m.v.photos);
  const next = order.filter((p, i) => owned.has(p) && order.indexOf(p) === i);
  for (const p of m.v.photos) if (!next.includes(p)) next.push(p);
  await db.update(vehicles).set({ photos: next, updatedAt: new Date() }).where(and(eq(vehicles.id, m.v.id), eq(vehicles.businessId, m.ctx.business.id)));
  refresh(m.v.id);
  return { ok: true };
}

/** Changer le statut en un clic : en vente, réservé, vendu, brouillon. */
export async function setVehicleStatus(id: string, status: string): Promise<Result> {
  const ctx = await requireContext(undefined, { app: "vehicules" });
  if (ctx.impersonating) return SUPERVISION;
  if (!vehicleRights(ctx).manage) return { ok: false, error: "Seul le responsable modifie les véhicules." };
  if (!isVehicleStatus(status)) return { ok: false, error: "Statut inconnu." };
  const v = await vehicleOf(ctx.business.id, z.uuid().parse(id));
  if (!v) return { ok: false, error: "Véhicule introuvable." };
  await db
    .update(vehicles)
    .set({ status, publishedAt: status === "for_sale" || status === "reserved" ? (v.publishedAt ?? new Date()) : v.publishedAt, soldAt: status === "sold" ? (v.soldAt ?? new Date()) : null, updatedAt: new Date() })
    .where(and(eq(vehicles.id, v.id), eq(vehicles.businessId, ctx.business.id)));
  refresh(v.id);
  return { ok: true };
}

/** Supprimer définitivement un véhicule et ses photos. */
export async function deleteVehicle(id: string): Promise<Result> {
  const ctx = await requireContext(undefined, { app: "vehicules" });
  if (ctx.impersonating) return SUPERVISION;
  if (!vehicleRights(ctx).manage) return { ok: false, error: "Seul le responsable supprime les véhicules." };
  const v = await vehicleOf(ctx.business.id, z.uuid().parse(id));
  if (!v) return { ok: false, error: "Véhicule introuvable." };
  await db.delete(vehicles).where(and(eq(vehicles.id, v.id), eq(vehicles.businessId, ctx.business.id)));
  await Promise.all(v.photos.map((p) => deletePublicImage(p)));
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "vehicle.delete", description: `Véhicule supprimé : ${vehicleFullTitle(v)}` });
  refresh();
  return { ok: true };
}
