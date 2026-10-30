"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { diningTables, menuCategories, menuItems, tableOrders } from "@/db/schema";
import { ORDER_STATUS, isOrderStatus } from "@/lib/orders";
import { requireContext, type AppContext } from "@/server/context";
import { deletePublicImage, savePublicImage } from "@/server/storage";

type Result = { ok: true; message?: string; id?: string } | { ok: false; error: string };
const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };
const refresh = () => revalidatePath("/app/commandes", "layout");
/** La carte et les tables : le responsable (ou qui gère les réglages). Le suivi des commandes : toute l'équipe. */
const canEditMenu = (ctx: AppContext) => ctx.member.isOwner || ctx.can("settings.manage");
const newTableToken = async () => randomBytes(9).toString("base64url");

async function editor() {
  const ctx = await requireContext(undefined, { app: "commandes" });
  if (ctx.impersonating) return { ctx, error: SUPERVISION };
  if (!canEditMenu(ctx)) return { ctx, error: { ok: false as const, error: "Seul le responsable peut modifier la carte et les tables." } };
  return { ctx, error: null };
}

/* ───────── Carte ───────── */

export async function saveCategory(id: string | null, name: string): Promise<Result> {
  const { ctx, error } = await editor();
  if (error) return error;
  const v = z.string().trim().min(1, "Donnez un nom à la rubrique.").max(60).safeParse(name);
  if (!v.success) return { ok: false, error: v.error.issues[0]!.message };
  if (id) {
    const done = await db.update(menuCategories).set({ name: v.data, updatedAt: new Date() }).where(and(eq(menuCategories.id, id), eq(menuCategories.businessId, ctx.business.id))).returning({ id: menuCategories.id });
    if (!done.length) return { ok: false, error: "Rubrique introuvable." };
  } else {
    const [{ n }] = await db.select({ n: sql<number>`coalesce(max(${menuCategories.position}), -1)::int + 1` }).from(menuCategories).where(eq(menuCategories.businessId, ctx.business.id));
    await db.insert(menuCategories).values({ businessId: ctx.business.id, name: v.data, position: n });
  }
  refresh();
  return { ok: true, message: id ? "Rubrique renommée." : "Rubrique ajoutée." };
}

export async function deleteCategory(id: string): Promise<Result> {
  const { ctx, error } = await editor();
  if (error) return error;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Rubrique introuvable." };
  await db.delete(menuCategories).where(and(eq(menuCategories.id, id), eq(menuCategories.businessId, ctx.business.id)));
  refresh();
  return { ok: true, message: "Rubrique supprimée (ses plats restent, sans rubrique)." };
}

export async function moveCategory(id: string, dir: -1 | 1): Promise<Result> {
  const { ctx, error } = await editor();
  if (error) return error;
  const cats = await db.select({ id: menuCategories.id }).from(menuCategories).where(eq(menuCategories.businessId, ctx.business.id)).orderBy(menuCategories.position, menuCategories.createdAt);
  const i = cats.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= cats.length) return { ok: true };
  [cats[i], cats[j]] = [cats[j]!, cats[i]!];
  await db.transaction(async (tx) => {
    for (const [pos, c] of cats.entries()) await tx.update(menuCategories).set({ position: pos }).where(eq(menuCategories.id, c.id));
  });
  refresh();
  return { ok: true };
}

const itemSchema = z.object({
  id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(1, "Donnez un nom au plat.").max(80),
  description: z.string().trim().max(300),
  price: z.coerce.number().min(0, "Prix invalide.").max(10000).transform((n) => Math.round(n * 100)),
  categoryId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  tags: z.string().trim().max(120),
  removePhoto: z.literal("1").optional(),
});

/** Ajouter ou modifier un plat, avec sa photo (facultative). */
export async function saveMenuItem(fd: FormData): Promise<Result> {
  const { ctx, error } = await editor();
  if (error) return error;
  const raw = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string").map(([k, v]) => [k, k === "price" ? String(v).replace(",", ".") : v]));
  const v = itemSchema.safeParse(raw);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les champs." };
  const d = v.data;
  if (d.categoryId) {
    const [c] = await db.select({ id: menuCategories.id }).from(menuCategories).where(and(eq(menuCategories.id, d.categoryId), eq(menuCategories.businessId, ctx.business.id)));
    if (!c) return { ok: false, error: "Rubrique introuvable." };
  }
  let photoUrl: string | undefined;
  const file = fd.get("photo");
  if (file instanceof File && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) return { ok: false, error: "Photo trop lourde (5 Mo maximum)." };
    try {
      photoUrl = await savePublicImage(Buffer.from(await file.arrayBuffer()));
    } catch {
      return { ok: false, error: "Photo : JPG, PNG, WebP ou GIF." };
    }
  }
  const values = { name: d.name, description: d.description || null, priceCents: d.price, categoryId: d.categoryId ?? null, tags: d.tags || null, updatedAt: new Date() };
  if (d.id) {
    const [old] = await db.select({ photo: menuItems.photoUrl }).from(menuItems).where(and(eq(menuItems.id, d.id), eq(menuItems.businessId, ctx.business.id)));
    if (!old) return { ok: false, error: "Plat introuvable." };
    const photo = photoUrl ? { photoUrl } : d.removePhoto ? { photoUrl: null } : {};
    await db.update(menuItems).set({ ...values, ...photo }).where(and(eq(menuItems.id, d.id), eq(menuItems.businessId, ctx.business.id)));
    if ((photoUrl || d.removePhoto) && old.photo) await deletePublicImage(old.photo);
  } else {
    const [{ n }] = await db.select({ n: sql<number>`coalesce(max(${menuItems.position}), -1)::int + 1` }).from(menuItems).where(eq(menuItems.businessId, ctx.business.id));
    await db.insert(menuItems).values({ ...values, businessId: ctx.business.id, photoUrl: photoUrl ?? null, position: n });
  }
  refresh();
  return { ok: true, message: d.id ? "Plat modifié." : "Plat ajouté à la carte." };
}

export async function deleteMenuItem(id: string): Promise<Result> {
  const { ctx, error } = await editor();
  if (error) return error;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Plat introuvable." };
  const [gone] = await db.delete(menuItems).where(and(eq(menuItems.id, id), eq(menuItems.businessId, ctx.business.id))).returning({ photo: menuItems.photoUrl });
  if (gone?.photo) await deletePublicImage(gone.photo);
  refresh();
  return { ok: true, message: "Plat retiré de la carte." };
}

/** Épuisé / de nouveau disponible : toute l'équipe peut le faire (la cuisine sait ce qui manque). */
export async function setItemAvailable(id: string, available: boolean): Promise<Result> {
  const ctx = await requireContext(undefined, { app: "commandes" });
  if (ctx.impersonating) return SUPERVISION;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Plat introuvable." };
  await db.update(menuItems).set({ available, updatedAt: new Date() }).where(and(eq(menuItems.id, id), eq(menuItems.businessId, ctx.business.id)));
  refresh();
  return { ok: true, message: available ? "De nouveau disponible." : "Marqué épuisé." };
}

/* ───────── Tables ───────── */

export async function addTables(input: { prefix: string; from: number; count: number }): Promise<Result> {
  const { ctx, error } = await editor();
  if (error) return error;
  const v = z.object({ prefix: z.string().trim().max(30), from: z.number().int().min(0).max(9999), count: z.number().int().min(1).max(100) }).safeParse(input);
  if (!v.success) return { ok: false, error: "Entre 1 et 100 tables à la fois." };
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(diningTables).where(eq(diningTables.businessId, ctx.business.id));
  if (n + v.data.count > 300) return { ok: false, error: "300 tables maximum." };
  // Une table qui existe déjà (même nom) n'est pas recréée : deux « Table 1 » avec deux QR différents prêtent à confusion.
  const taken = new Set((await db.select({ l: diningTables.label }).from(diningTables).where(eq(diningTables.businessId, ctx.business.id))).map((r) => r.l.trim().toLowerCase()));
  const rows = [];
  let skipped = 0;
  for (let i = 0; i < v.data.count; i++) {
    const label = `${v.data.prefix || "Table"} ${v.data.from + i}`.trim();
    if (taken.has(label.toLowerCase())) { skipped++; continue; }
    rows.push({ businessId: ctx.business.id, label, token: await newTableToken(), position: n + rows.length });
  }
  if (!rows.length) return { ok: false, error: skipped > 1 ? "Ces tables existent déjà." : "Cette table existe déjà." };
  await db.insert(diningTables).values(rows);
  refresh();
  return { ok: true, message: `${rows.length} table${rows.length > 1 ? "s" : ""} ajoutée${rows.length > 1 ? "s" : ""}.${skipped ? ` ${skipped} déjà existante${skipped > 1 ? "s" : ""}, ignorée${skipped > 1 ? "s" : ""}.` : ""}` };
}

export async function renameTable(id: string, label: string): Promise<Result> {
  const { ctx, error } = await editor();
  if (error) return error;
  const v = z.string().trim().min(1).max(40).safeParse(label);
  if (!v.success || !z.uuid().safeParse(id).success) return { ok: false, error: "Nom de table invalide." };
  await db.update(diningTables).set({ label: v.data, updatedAt: new Date() }).where(and(eq(diningTables.id, id), eq(diningTables.businessId, ctx.business.id)));
  refresh();
  return { ok: true, message: "Table renommée." };
}

/** Nouveau QR code pour une table (l'ancien ne fonctionne plus). */
export async function regenerateTable(id: string): Promise<Result> {
  const { ctx, error } = await editor();
  if (error) return error;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Table introuvable." };
  await db.update(diningTables).set({ token: await newTableToken(), updatedAt: new Date() }).where(and(eq(diningTables.id, id), eq(diningTables.businessId, ctx.business.id)));
  refresh();
  return { ok: true, message: "Nouveau QR code créé : réimprimez-le, l'ancien ne marche plus." };
}

export async function deleteTable(id: string): Promise<Result> {
  const { ctx, error } = await editor();
  if (error) return error;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Table introuvable." };
  await db.delete(diningTables).where(and(eq(diningTables.id, id), eq(diningTables.businessId, ctx.business.id)));
  refresh();
  return { ok: true, message: "Table supprimée." };
}

/* ───────── Suivi des commandes ───────── */

export async function setOrderStatus(id: string, status: string): Promise<Result> {
  const ctx = await requireContext(undefined, { app: "commandes" });
  if (ctx.impersonating) return SUPERVISION;
  if (!z.uuid().safeParse(id).success || !isOrderStatus(status)) return { ok: false, error: "Commande introuvable." };
  const done = await db.update(tableOrders).set({ status, updatedAt: new Date() }).where(and(eq(tableOrders.id, id), eq(tableOrders.businessId, ctx.business.id))).returning({ n: tableOrders.number });
  if (!done.length) return { ok: false, error: "Commande introuvable." };
  refresh();
  return { ok: true, message: `Commande n° ${done[0]!.n} : ${ORDER_STATUS[status].label.toLowerCase()}.` };
}

export async function setOrderPaid(id: string, paid: boolean): Promise<Result> {
  const ctx = await requireContext(undefined, { app: "commandes" });
  if (ctx.impersonating) return SUPERVISION;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Commande introuvable." };
  await db.update(tableOrders).set({ paidAt: paid ? new Date() : null, updatedAt: new Date() }).where(and(eq(tableOrders.id, id), eq(tableOrders.businessId, ctx.business.id)));
  refresh();
  return { ok: true, message: paid ? "Commande encaissée." : "Encaissement annulé." };
}
