import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookingPageSettings, businesses, users, vehicles } from "@/db/schema";
import type { AppContext } from "@/server/context";

export type VehicleRow = typeof vehicles.$inferSelect;

/** Droits : voir = l'app ouverte au grade ; modifier = le responsable (comme le Stock). */
export const vehicleRights = (ctx: AppContext) => ({ view: ctx.canApp("vehicules"), manage: ctx.member.isOwner || ctx.can("settings.manage") });

export async function vehiclesOf(businessId: string) {
  return db.select().from(vehicles).where(eq(vehicles.businessId, businessId)).orderBy(sql`case ${vehicles.status} when 'for_sale' then 0 when 'reserved' then 1 when 'draft' then 2 else 3 end`, desc(vehicles.updatedAt));
}

export async function vehicleOf(businessId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [v] = await db.select().from(vehicles).where(and(eq(vehicles.businessId, businessId), eq(vehicles.id, id)));
  return v ?? null;
}

/** Colonnes publiques uniquement (jamais le VIN, la plaque, le prix d'achat ni la note interne). */
const publicCols = {
  id: vehicles.id, slug: vehicles.slug, status: vehicles.status, make: vehicles.make, model: vehicles.model, version: vehicles.version, bodyType: vehicles.bodyType, fuel: vehicles.fuel, gearbox: vehicles.gearbox,
  firstRegistration: vehicles.firstRegistration, mileageKm: vehicles.mileageKm, powerKw: vehicles.powerKw, engineCc: vehicles.engineCc, co2: vehicles.co2, euroNorm: vehicles.euroNorm, color: vehicles.color, interior: vehicles.interior,
  doors: vehicles.doors, seats: vehicles.seats, owners: vehicles.owners, priceCents: vehicles.priceCents, vatMode: vehicles.vatMode, warrantyMonths: vehicles.warrantyMonths, carPass: vehicles.carPass, serviceHistory: vehicles.serviceHistory,
  equipment: vehicles.equipment, description: vehicles.description, photos: vehicles.photos, publishedAt: vehicles.publishedAt,
};
export type PublicVehicle = { [K in keyof typeof publicCols]: VehicleRow[K] };

/** Entreprise visible publiquement (ni supprimée, ni en pause, ni démo, propriétaire actif). */
async function publicBusiness(slug: string) {
  const [b] = await db
    .select({ id: businesses.id, name: businesses.name, slug: businesses.slug, city: businesses.city, address: businesses.address, postalCode: businesses.postalCode, phone: businesses.phone, email: businesses.email, photoUrl: businesses.photoUrl, theme: bookingPageSettings.theme })
    .from(businesses)
    .innerJoin(users, eq(users.id, businesses.ownerId))
    .leftJoin(bookingPageSettings, eq(bookingPageSettings.businessId, businesses.id))
    .where(and(eq(businesses.slug, slug), isNull(businesses.deletedAt), isNull(businesses.pausedAt), isNull(users.disabledAt), eq(businesses.isDemo, false)));
  return b ?? null;
}

export type VehicleFilters = { make?: string; fuel?: string; gearbox?: string; maxPrice?: number; maxKm?: number; sort?: "recent" | "price-asc" | "price-desc" | "km-asc" };

/** Vitrine publique : véhicules en vente et réservés d'une entreprise. */
export async function publicVehicles(slug: string, f: VehicleFilters = {}) {
  const b = await publicBusiness(slug);
  if (!b) return null;
  const conds = [eq(vehicles.businessId, b.id), inArray(vehicles.status, ["for_sale", "reserved"])];
  if (f.make) conds.push(ilike(vehicles.make, f.make.replace(/[%_\\]/g, "")));
  if (f.fuel) conds.push(eq(vehicles.fuel, f.fuel));
  if (f.gearbox) conds.push(eq(vehicles.gearbox, f.gearbox));
  if (f.maxPrice) conds.push(lte(vehicles.priceCents, f.maxPrice * 100));
  if (f.maxKm) conds.push(lte(vehicles.mileageKm, f.maxKm));
  const order =
    f.sort === "price-asc" ? [sql`${vehicles.priceCents} asc nulls last`] : f.sort === "price-desc" ? [sql`${vehicles.priceCents} desc nulls last`] : f.sort === "km-asc" ? [sql`${vehicles.mileageKm} asc nulls last`] : [asc(sql`case ${vehicles.status} when 'for_sale' then 0 else 1 end`), desc(vehicles.publishedAt)];
  const [rows, makes] = await Promise.all([
    db.select(publicCols).from(vehicles).where(and(...conds)).orderBy(...order).limit(200),
    db.selectDistinct({ make: vehicles.make }).from(vehicles).where(and(eq(vehicles.businessId, b.id), inArray(vehicles.status, ["for_sale", "reserved"]))).orderBy(asc(vehicles.make)),
  ]);
  return { business: b, vehicles: rows as PublicVehicle[], makes: makes.map((m) => m.make) };
}

/** Fiche publique d'un véhicule (en vente, réservé ; un véhicule vendu reste lisible avec la mention « Vendu »). */
export async function publicVehicle(slug: string, vehicleSlug: string) {
  const b = await publicBusiness(slug);
  if (!b) return null;
  const [v] = await db.select(publicCols).from(vehicles).where(and(eq(vehicles.businessId, b.id), eq(vehicles.slug, vehicleSlug), inArray(vehicles.status, ["for_sale", "reserved", "sold"])));
  if (!v) return null;
  const others = await db
    .select(publicCols)
    .from(vehicles)
    .where(and(eq(vehicles.businessId, b.id), inArray(vehicles.status, ["for_sale", "reserved"]), sql`${vehicles.id} <> ${v.id}`))
    .orderBy(desc(vehicles.publishedAt))
    .limit(3);
  return { business: b, vehicle: v as PublicVehicle, others: others as PublicVehicle[] };
}

/** Nombre de véhicules visibles (lien « Nos véhicules » sur la page de l'entreprise). */
export async function publicVehicleCount(businessId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(vehicles).where(and(eq(vehicles.businessId, businessId), inArray(vehicles.status, ["for_sale", "reserved"])));
  return r?.n ?? 0;
}

/** Plan du site : véhicules publiés de toutes les entreprises visibles. */
export async function sitemapVehicles() {
  return db
    .select({ slug: vehicles.slug, biz: businesses.slug, updatedAt: vehicles.updatedAt })
    .from(vehicles)
    .innerJoin(businesses, eq(businesses.id, vehicles.businessId))
    .innerJoin(users, eq(users.id, businesses.ownerId))
    .where(and(inArray(vehicles.status, ["for_sale", "reserved"]), isNull(businesses.deletedAt), isNull(businesses.pausedAt), isNull(users.disabledAt), eq(businesses.isDemo, false), gte(vehicles.updatedAt, sql`now() - interval '2 years'`)))
    .limit(5000);
}
