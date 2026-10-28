"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { posSales, products, stockMoves } from "@/db/schema";
import { VAT_RATES, parseEuros } from "@/lib/stock";

const DONE = { in: "réception enregistrée", out: "sortie enregistrée", count: "inventaire enregistré" } as const;
import { requireContext } from "@/server/context";
import { stockRights } from "@/server/stock";
import { deletePublicImage, savePublicImage } from "@/server/storage";

type Result = { ok: true; message?: string; id?: string } | { ok: false; error: string };
const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };
const refresh = () => { revalidatePath("/app/stock", "layout"); revalidatePath("/app/caisse", "layout"); };
const isUnique = (e: unknown) => { const x = e as { code?: string; cause?: { code?: string } }; return x.code === "23505" || x.cause?.code === "23505"; };

const euros = (msg: string) => z.string().transform((v, c) => { const n = v.trim() === "" ? 0 : parseEuros(v); if (n === null) { c.addIssue({ code: "custom", message: msg }); return z.NEVER; } return n; });
const productSchema = z.object({
  id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(1, "Donnez un nom au produit.").max(120),
  sku: z.string().trim().max(60),
  barcode: z.string().trim().max(40).regex(/^[\w-]*$/, "Code-barres : chiffres et lettres seulement."),
  category: z.string().trim().max(60),
  price: euros("Prix de vente invalide."),
  vatRate: z.coerce.number().refine((v) => (VAT_RATES as readonly number[]).includes(v), "Taux de TVA invalide."),
  cost: z.string().trim(),
  trackStock: z.literal("1").optional(),
  minQty: z.string().trim().regex(/^\d{0,6}$/, "Seuil invalide."),
  stockQty: z.string().trim().regex(/^-?\d{0,6}$/, "Quantité invalide.").optional(),
  supplier: z.string().trim().max(120),
  removePhoto: z.literal("1").optional(),
  onlineEnabled: z.literal("1").optional(),
  description: z.string().trim().max(1000).optional(),
});

/** Ajouter ou modifier un produit (photo facultative). La quantité de départ crée un mouvement « Inventaire ». */
export async function saveProduct(fd: FormData): Promise<Result> {
  const ctx = await requireContext(undefined, { app: "stock" });
  if (ctx.impersonating) return SUPERVISION;
  if (!stockRights(ctx).manage) return { ok: false, error: "Seul le responsable modifie les produits et les prix." };
  const raw = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));
  const v = productSchema.safeParse({ sku: "", barcode: "", category: "", cost: "", minQty: "", supplier: "", ...raw });
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les champs." };
  const d = v.data;
  const cost = d.cost ? parseEuros(d.cost) : null;
  if (d.cost && cost === null) return { ok: false, error: "Prix d'achat invalide." };
  let photoUrl: string | undefined;
  const file = fd.get("photo");
  if (file instanceof File && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) return { ok: false, error: "Photo trop lourde (5 Mo maximum)." };
    try { photoUrl = await savePublicImage(Buffer.from(await file.arrayBuffer())); } catch { return { ok: false, error: "Photo : JPG, PNG, WebP ou GIF." }; }
  }
  const values = { name: d.name, sku: d.sku || null, barcode: d.barcode || null, category: d.category || null, priceCents: d.price, vatRate: d.vatRate, costCents: cost, trackStock: !!d.trackStock, minQty: d.minQty ? Number(d.minQty) : null, supplier: d.supplier || null, onlineEnabled: !!d.onlineEnabled, description: d.description || null, updatedAt: new Date() };
  try {
    if (d.id) {
      const [old] = await db.select({ photo: products.photoUrl }).from(products).where(and(eq(products.id, d.id), eq(products.businessId, ctx.business.id)));
      if (!old) return { ok: false, error: "Produit introuvable." };
      await db.update(products).set({ ...values, ...(photoUrl ? { photoUrl } : d.removePhoto ? { photoUrl: null } : {}) }).where(and(eq(products.id, d.id), eq(products.businessId, ctx.business.id)));
      if ((photoUrl || d.removePhoto) && old.photo) await deletePublicImage(old.photo).catch(() => {});
      refresh();
      return { ok: true, message: "Produit enregistré.", id: d.id };
    }
    const qty = d.stockQty ? Number(d.stockQty) : 0;
    const id = await db.transaction(async (tx) => {
      const [row] = await tx.insert(products).values({ ...values, businessId: ctx.business.id, photoUrl: photoUrl ?? null, stockQty: values.trackStock ? qty : 0 }).returning({ id: products.id });
      if (values.trackStock && qty) await tx.insert(stockMoves).values({ businessId: ctx.business.id, productId: row!.id, delta: qty, reason: "count", note: "Stock de départ", memberId: ctx.member.id });
      return row!.id;
    });
    refresh();
    return { ok: true, message: "Produit ajouté.", id };
  } catch (e) {
    if (isUnique(e)) return { ok: false, error: "Un autre produit a déjà ce code-barres." };
    throw e;
  }
}

/** Retirer un produit : supprimé s'il n'a jamais servi, sinon archivé (les tickets passés restent lisibles). */
export async function deleteProduct(id: string): Promise<Result> {
  const ctx = await requireContext(undefined, { app: "stock" });
  if (ctx.impersonating) return SUPERVISION;
  if (!stockRights(ctx).manage) return { ok: false, error: "Seul le responsable modifie les produits." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Produit introuvable." };
  const [used] = await db.select({ n: sql<number>`count(*)::int` }).from(posSales).where(and(eq(posSales.businessId, ctx.business.id), sql`${posSales.lines} @> ${JSON.stringify([{ productId: id }])}::jsonb`));
  if (used?.n) {
    await db.update(products).set({ active: false, updatedAt: new Date() }).where(and(eq(products.id, id), eq(products.businessId, ctx.business.id)));
    refresh();
    return { ok: true, message: "Produit archivé (il figure sur des tickets)." };
  }
  const [gone] = await db.delete(products).where(and(eq(products.id, id), eq(products.businessId, ctx.business.id))).returning({ photo: products.photoUrl });
  if (gone?.photo) await deletePublicImage(gone.photo).catch(() => {});
  refresh();
  return { ok: true, message: "Produit supprimé." };
}

export async function restoreProduct(id: string): Promise<Result> {
  const ctx = await requireContext(undefined, { app: "stock" });
  if (ctx.impersonating) return SUPERVISION;
  if (!stockRights(ctx).manage || !z.uuid().safeParse(id).success) return { ok: false, error: "Action impossible." };
  await db.update(products).set({ active: true, updatedAt: new Date() }).where(and(eq(products.id, id), eq(products.businessId, ctx.business.id)));
  refresh();
  return { ok: true, message: "Produit remis en vente." };
}

const moveSchema = z.object({
  productId: z.uuid(),
  reason: z.enum(["in", "out", "count"]),
  qty: z.number().int().min(0).max(1_000_000),
  note: z.string().trim().max(200),
});

/** Réception (+), sortie (casse, usage interne : −) ou inventaire (quantité comptée). Toute l'équipe peut le faire. */
export async function moveStock(input: z.input<typeof moveSchema>): Promise<Result> {
  const ctx = await requireContext(undefined, { app: "stock" });
  if (ctx.impersonating) return SUPERVISION;
  const v = moveSchema.safeParse(input);
  if (!v.success) return { ok: false, error: "Quantité invalide." };
  const d = v.data;
  if (d.reason !== "count" && d.qty === 0) return { ok: false, error: "Indiquez une quantité." };
  return db.transaction(async (tx) => {
    const [p] = await tx.select({ qty: products.stockQty, track: products.trackStock, name: products.name }).from(products).where(and(eq(products.id, d.productId), eq(products.businessId, ctx.business.id))).for("update");
    if (!p) return { ok: false as const, error: "Produit introuvable." };
    if (!p.track) return { ok: false as const, error: "Le stock de ce produit n'est pas suivi." };
    const delta = d.reason === "in" ? d.qty : d.reason === "out" ? -d.qty : d.qty - p.qty;
    if (delta === 0) return { ok: true as const, message: "Stock inchangé." };
    const next = p.qty + delta;
    await tx.update(products).set({ stockQty: next, ...(delta > 0 ? { lowNotifiedAt: null } : {}), updatedAt: new Date() }).where(eq(products.id, d.productId));
    await tx.insert(stockMoves).values({ businessId: ctx.business.id, productId: d.productId, delta, reason: d.reason, note: d.note || null, memberId: ctx.member.id });
    refresh();
    return { ok: true as const, message: `${p.name} : ${DONE[d.reason]}, stock ${next}.` };
  });
}
