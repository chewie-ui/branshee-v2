"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { posSales, products, stockMoves } from "@/db/schema";
import { gridById, variantName } from "@/lib/sizes";
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
  if (typeof fd.get("variants") === "string") return saveModel(ctx, d.id, values, String(fd.get("variants")), String(fd.get("sizeGrid") ?? ""), photoUrl, !!d.removePhoto);
  try {
    if (d.id) {
      const [old] = await db.select({ photo: products.photoUrl, parentId: products.parentId, isModel: products.isModel }).from(products).where(and(eq(products.id, d.id), eq(products.businessId, ctx.business.id)));
      if (!old) return { ok: false, error: "Produit introuvable." };
      if (old.parentId || old.isModel) return { ok: false, error: "Ce produit a des tailles ou couleurs : modifiez-le depuis sa fiche modèle." };
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

const variantSchema = z.array(z.object({ id: z.uuid().optional(), size: z.string().trim().max(30).nullable(), color: z.string().trim().max(40).nullable(), barcode: z.string().trim().max(40).regex(/^[\w-]*$/, "Code-barres : chiffres et lettres seulement.").default(""), qty: z.string().trim().regex(/^\d{0,6}$/, "Quantité invalide.").default("") })).min(1, "Choisissez au moins une taille ou une couleur.").max(300, "300 déclinaisons maximum par produit.");
type Values = { name: string; sku: string | null; barcode: string | null; category: string | null; priceCents: number; vatRate: number; costCents: number | null; trackStock: boolean; minQty: number | null; supplier: string | null; onlineEnabled: boolean; description: string | null; updatedAt: Date };

/**
 * Produit en plusieurs tailles et/ou couleurs : un modèle (jamais vendu tel quel) et une déclinaison par
 * combinaison, avec son propre stock et son code-barres. Prix, TVA, photo… sont ceux du modèle.
 */
async function saveModel(ctx: Awaited<ReturnType<typeof requireContext>>, id: string | undefined, values: Values, rawVariants: string, sizeGrid: string, photoUrl: string | undefined, removePhoto: boolean): Promise<Result> {
  let parsed: unknown;
  try { parsed = JSON.parse(rawVariants); } catch { return { ok: false, error: "Déclinaisons illisibles." }; }
  const v = variantSchema.safeParse(parsed);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les tailles et couleurs." };
  const list = v.data.map((x) => ({ ...x, size: x.size || null, color: x.color || null })).filter((x) => x.size || x.color);
  if (!list.length) return { ok: false, error: "Choisissez au moins une taille ou une couleur." };
  const keys = list.map((x) => `${(x.size ?? "").toLowerCase()}|${(x.color ?? "").toLowerCase()}`);
  if (new Set(keys).size !== keys.length) return { ok: false, error: "Deux déclinaisons ont la même taille et la même couleur." };
  const codes = list.map((x) => x.barcode).filter(Boolean);
  if (new Set(codes).size !== codes.length) return { ok: false, error: "Deux déclinaisons ont le même code-barres." };
  const grid = gridById(sizeGrid)?.id ?? null;
  const common = { category: values.category, priceCents: values.priceCents, vatRate: values.vatRate, costCents: values.costCents, trackStock: values.trackStock, minQty: values.minQty, supplier: values.supplier, onlineEnabled: values.onlineEnabled, description: values.description, sizeGrid: grid, updatedAt: new Date() };
  try {
    const out = await db.transaction(async (tx) => {
      let modelId = id;
      let oldPhoto: string | null = null;
      if (modelId) {
        const [m] = await tx.select().from(products).where(and(eq(products.id, modelId), eq(products.businessId, ctx.business.id))).for("update");
        if (!m) return { ok: false as const, error: "Produit introuvable." };
        if (m.parentId) return { ok: false as const, error: "Modifiez le modèle, pas une de ses déclinaisons." };
        if (!m.isModel && m.trackStock && m.stockQty !== 0) return { ok: false as const, error: `Ce produit a ${m.stockQty} pièce(s) en stock : faites d'abord un inventaire à 0, puis ajoutez les tailles avec leur quantité.` };
        oldPhoto = m.photoUrl;
        await tx.update(products).set({ ...common, name: values.name, sku: values.sku, barcode: null, isModel: true, trackStock: false, stockQty: 0, ...(photoUrl ? { photoUrl } : removePhoto ? { photoUrl: null } : {}) }).where(eq(products.id, modelId));
      } else {
        const [row] = await tx.insert(products).values({ ...common, businessId: ctx.business.id, name: values.name, sku: values.sku, barcode: null, isModel: true, trackStock: false, stockQty: 0, photoUrl: photoUrl ?? null }).returning({ id: products.id });
        modelId = row!.id;
      }
      const photo = photoUrl ?? (removePhoto ? null : oldPhoto);
      const existing = await tx.select({ id: products.id }).from(products).where(and(eq(products.parentId, modelId), eq(products.businessId, ctx.business.id)));
      const known = new Set(existing.map((e) => e.id));
      const keep = new Set<string>();
      let created = 0;
      for (const x of list) {
        const vals = { ...common, name: variantName(values.name, x), size: x.size, color: x.color, barcode: x.barcode || null, photoUrl: photo };
        if (x.id && known.has(x.id)) {
          keep.add(x.id);
          await tx.update(products).set({ ...vals, active: true }).where(eq(products.id, x.id));
        } else {
          const qty = values.trackStock && x.qty ? Number(x.qty) : 0;
          const [row] = await tx.insert(products).values({ ...vals, businessId: ctx.business.id, parentId: modelId, stockQty: qty }).returning({ id: products.id });
          if (qty) await tx.insert(stockMoves).values({ businessId: ctx.business.id, productId: row!.id, delta: qty, reason: "count", note: "Stock de départ", memberId: ctx.member.id });
          created++;
        }
      }
      // Déclinaisons retirées : supprimées si jamais vendues ni en stock, sinon archivées (tickets et stock restent lisibles).
      const removed = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
      const stockOf = new Map((removed.length ? await tx.select({ id: products.id, q: products.stockQty }).from(products).where(inArray(products.id, removed)) : []).map((r) => [r.id, r.q]));
      for (const rid of removed) {
        const [used] = await tx.select({ n: sql<number>`count(*)::int` }).from(posSales).where(and(eq(posSales.businessId, ctx.business.id), sql`${posSales.lines} @> ${JSON.stringify([{ productId: rid }])}::jsonb`));
        const [moved] = await tx.select({ n: sql<number>`count(*)::int` }).from(stockMoves).where(and(eq(stockMoves.productId, rid), sql`${stockMoves.reason} <> 'count'`));
        if (used?.n || moved?.n || stockOf.get(rid)) await tx.update(products).set({ active: false, updatedAt: new Date() }).where(eq(products.id, rid));
        else await tx.delete(products).where(eq(products.id, rid));
      }
      return { ok: true as const, id: modelId, created, removed: removed.length, oldPhoto: photoUrl || removePhoto ? oldPhoto : null };
    });
    if (!out.ok) return out;
    if (out.oldPhoto) await deletePublicImage(out.oldPhoto).catch(() => {});
    refresh();
    return { ok: true, id: out.id, message: id ? `Produit enregistré${out.created ? ` : ${out.created} déclinaison${out.created > 1 ? "s" : ""} ajoutée${out.created > 1 ? "s" : ""}` : ""}${out.removed ? `, ${out.removed} retirée${out.removed > 1 ? "s" : ""}` : ""}.` : `Produit ajouté avec ${list.length} déclinaison${list.length > 1 ? "s" : ""}.` };
  } catch (e) {
    if (isUnique(e)) return { ok: false, error: "Un autre produit a déjà un de ces codes-barres." };
    throw e;
  }
}

/** Inventaire d'un modèle en une fois : la quantité comptée pour chaque taille/couleur. */
export async function countVariants(modelId: string, counts: { id: string; qty: number }[]): Promise<Result> {
  const ctx = await requireContext(undefined, { app: "stock" });
  if (ctx.impersonating) return SUPERVISION;
  const v = z.object({ modelId: z.uuid(), counts: z.array(z.object({ id: z.uuid(), qty: z.number().int().min(0).max(1_000_000) })).min(1).max(300) }).safeParse({ modelId, counts });
  if (!v.success) return { ok: false, error: "Quantités invalides." };
  const changed = await db.transaction(async (tx) => {
    const rows = await tx.select({ id: products.id, qty: products.stockQty, track: products.trackStock }).from(products).where(and(eq(products.businessId, ctx.business.id), eq(products.parentId, v.data.modelId), inArray(products.id, v.data.counts.map((c) => c.id)))).for("update");
    let n = 0;
    for (const r of rows) {
      const want = v.data.counts.find((c) => c.id === r.id)!.qty;
      if (!r.track || want === r.qty) continue;
      await tx.update(products).set({ stockQty: want, ...(want > r.qty ? { lowNotifiedAt: null } : {}), updatedAt: new Date() }).where(eq(products.id, r.id));
      await tx.insert(stockMoves).values({ businessId: ctx.business.id, productId: r.id, delta: want - r.qty, reason: "count", note: "Inventaire par tailles", memberId: ctx.member.id });
      n++;
    }
    return n;
  });
  refresh();
  return { ok: true, message: changed ? `Inventaire enregistré (${changed} quantité${changed > 1 ? "s" : ""} corrigée${changed > 1 ? "s" : ""}).` : "Inventaire : rien n'a changé." };
}

/** Retirer un produit : supprimé s'il n'a jamais servi, sinon archivé (les tickets passés restent lisibles). */
export async function deleteProduct(id: string): Promise<Result> {
  const ctx = await requireContext(undefined, { app: "stock" });
  if (ctx.impersonating) return SUPERVISION;
  if (!stockRights(ctx).manage) return { ok: false, error: "Seul le responsable modifie les produits." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Produit introuvable." };
  // Un modèle : la décision vaut pour lui et toutes ses tailles/couleurs.
  const ids = [id, ...(await db.select({ id: products.id }).from(products).where(and(eq(products.parentId, id), eq(products.businessId, ctx.business.id)))).map((r) => r.id)];
  const [used] = await db.select({ n: sql<number>`count(*)::int` }).from(posSales).where(and(eq(posSales.businessId, ctx.business.id), sql`(${sql.join(ids.map((x) => sql`${posSales.lines} @> ${JSON.stringify([{ productId: x }])}::jsonb`), sql` or `)})`));
  if (used?.n) {
    await db.update(products).set({ active: false, updatedAt: new Date() }).where(and(inArray(products.id, ids), eq(products.businessId, ctx.business.id)));
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
  await db.update(products).set({ active: true, updatedAt: new Date() }).where(and(sql`(${products.id} = ${id} or ${products.parentId} = ${id})`, eq(products.businessId, ctx.business.id)));
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
    if (!p.track) return { ok: false as const, error: "Le stock de ce produit n'est pas suivi (pour un produit en tailles, choisissez la taille)." };
    const delta = d.reason === "in" ? d.qty : d.reason === "out" ? -d.qty : d.qty - p.qty;
    if (delta === 0) return { ok: true as const, message: "Stock inchangé." };
    const next = p.qty + delta;
    if (d.reason === "out" && next < 0) return { ok: false as const, error: `Sortie impossible : il n'y a que ${p.qty} « ${p.name} » en stock. Faites un inventaire si le chiffre est faux.` };
    await tx.update(products).set({ stockQty: next, ...(delta > 0 ? { lowNotifiedAt: null } : {}), updatedAt: new Date() }).where(eq(products.id, d.productId));
    await tx.insert(stockMoves).values({ businessId: ctx.business.id, productId: d.productId, delta, reason: d.reason, note: d.note || null, memberId: ctx.member.id });
    refresh();
    return { ok: true as const, message: `${p.name} : ${DONE[d.reason]}, stock ${next}.` };
  });
}
