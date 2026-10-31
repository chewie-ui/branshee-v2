import "server-only";
import { headers } from "next/headers";
import { countVariants, deleteProduct, moveStock, restoreProduct, saveProduct } from "@/server/actions/stock";
import { fail, forbidden, formData, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { currentContext, type AppContext } from "@/server/context";
import { isLocked } from "@/server/plan";
import { movesOf, productsOf, stockRights } from "@/server/stock";

/** API mobile de l'app Stock (Skydev) : produits, alertes, réception / sortie / inventaire, mouvements. */

async function needStock(): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("stock")) return forbidden();
  const method = (await headers()).get("x-method") ?? "POST";
  if (method !== "GET" && (await isLocked(ctx.business.id, ctx.business.brand))) return fail(402, "read_only", "Votre essai est terminé : abonnez-vous pour continuer à modifier.");
  return ctx;
}

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const ok = <T extends { ok: boolean }>(r: T) => {
  const e = r as { ok: boolean; error?: string };
  if (!e.ok) return invalid(e.error ?? "Action impossible.");
  return r as T & { id?: string; message?: string };
};

async function list() {
  const ctx = await needStock();
  const manage = stockRights(ctx).manage;
  const rows = await productsOf(ctx.business.id);
  return { canManage: manage, products: manage ? rows : rows.map((p) => ({ ...p, costCents: null })) };
}

/** Fiche produit simple (sans tailles/couleurs : ces modèles se modifient sur le site). */
async function save(r: ApiRequest, id: string | null) {
  await needStock();
  if (id && !uuid(id)) return fail(404, "not_found", "Produit introuvable.");
  const b = r.body;
  const res = ok(
    await saveProduct(
      formData({
        id: id ?? "",
        name: str(b.name, 120),
        sku: str(b.sku, 60),
        barcode: str(b.barcode, 40),
        category: str(b.category, 60),
        price: str(b.price, 12),
        vatRate: Number(b.vatRate ?? 21),
        cost: str(b.cost, 12),
        trackStock: b.trackStock ? "1" : null,
        minQty: b.minQty == null || b.minQty === "" ? "" : String(Number(b.minQty) || 0),
        stockQty: id ? null : String(Number(b.stockQty) || 0),
        supplier: str(b.supplier, 120),
        onlineEnabled: b.onlineEnabled ? "1" : null,
        description: str(b.description, 1000),
      }),
    ),
  );
  return { ok: true, id: res.id ?? id, message: res.message ?? null };
}

export const stockRoutes: Route[] = [
  { method: "GET", path: "/stock/products", handler: list },
  { method: "POST", path: "/stock/products", handler: (r) => save(r, null) },
  { method: "PATCH", path: "/stock/products/:id", handler: (r) => save(r, r.params.id!) },
  {
    method: "DELETE",
    path: "/stock/products/:id",
    handler: async (r) => {
      await needStock();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Produit introuvable.");
      return { ok: true, message: ok(await deleteProduct(r.params.id!)).message ?? null };
    },
  },
  {
    method: "POST",
    path: "/stock/products/:id/restore",
    handler: async (r) => {
      await needStock();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Produit introuvable.");
      return { ok: true, message: ok(await restoreProduct(r.params.id!)).message ?? null };
    },
  },
  {
    method: "POST",
    path: "/stock/products/:id/move",
    handler: async (r) => {
      await needStock();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Produit introuvable.");
      const reason = r.body.reason === "out" ? "out" : r.body.reason === "count" ? "count" : "in";
      const res = ok(await moveStock({ productId: r.params.id!, reason, qty: Math.max(0, Math.round(Number(r.body.qty) || 0)), note: str(r.body.note, 200) }));
      return { ok: true, message: res.message ?? null };
    },
  },
  {
    method: "POST",
    path: "/stock/products/:id/count-variants",
    handler: async (r) => {
      await needStock();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Produit introuvable.");
      const counts = Array.isArray(r.body.counts) ? (r.body.counts as { id?: unknown; qty?: unknown }[]).filter((c) => uuid(c?.id)).map((c) => ({ id: c.id as string, qty: Math.max(0, Math.round(Number(c.qty) || 0)) })) : [];
      return { ok: true, message: ok(await countVariants(r.params.id!, counts)).message ?? null };
    },
  },
  {
    method: "GET",
    path: "/stock/moves",
    handler: async (r) => {
      const ctx = await needStock();
      const pid = r.query.get("productId");
      const rows = await movesOf(ctx.business.id, uuid(pid) ? pid! : undefined);
      return { moves: rows.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })) };
    },
  },
];
