import "server-only";
import { headers } from "next/headers";
import { addTables, deleteCategory, deleteMenuItem, deleteTable, moveCategory, regenerateTable, renameTable, saveCategory, saveMenuItem, setItemAvailable, setOrderPaid, setOrderStatus } from "@/server/actions/orders";
import { bool, fail, forbidden, formData, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { currentContext, type AppContext } from "@/server/context";
import { menuOf, recentOrders, tableOrigin, tablesOf } from "@/server/orders";
import { isLocked } from "@/server/plan";

/** API mobile de l'app Commande à table (Skydev) : commandes en direct, carte, tables et QR codes. */

async function needOrders(): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("commandes")) return forbidden();
  const method = (await headers()).get("x-method") ?? "POST";
  if (method !== "GET" && (await isLocked(ctx.business.id, ctx.business.brand))) return fail(402, "read_only", "Votre essai est terminé : abonnez-vous pour continuer à modifier.");
  return ctx;
}

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const ok = <T extends { ok: boolean }>(r: T) => {
  const e = r as { ok: boolean; error?: string; message?: string };
  if (!e.ok) return invalid(e.error ?? "Action impossible.");
  return { ok: true, message: e.message ?? null };
};
const canEdit = (ctx: AppContext) => ctx.member.isOwner || ctx.can("settings.manage");
const idOr404 = (r: ApiRequest, what: string) => (uuid(r.params.id) ? r.params.id! : fail(404, "not_found", what));

async function menu() {
  const ctx = await needOrders();
  const { categories, items } = await menuOf(ctx.business.id);
  return { canEdit: canEdit(ctx), categories, items };
}

async function saveItem(r: ApiRequest, id: string | null) {
  await needOrders();
  const b = r.body;
  return ok(
    await saveMenuItem(
      formData({
        id: id ?? "",
        name: str(b.name, 80),
        description: str(b.description, 300),
        price: str(b.price, 12).replace(",", "."),
        categoryId: uuid(b.categoryId) ? (b.categoryId as string) : "",
        tags: str(b.tags, 120),
        removePhoto: bool(b.removePhoto) ? "1" : undefined,
      }),
    ),
  );
}

export const commandesRoutes: Route[] = [
  {
    method: "GET",
    path: "/table-orders",
    handler: async () => {
      const ctx = await needOrders();
      const [orders, tables] = await Promise.all([recentOrders(ctx.business.id), tablesOf(ctx.business.id)]);
      return {
        hasTables: tables.length > 0,
        canEdit: canEdit(ctx),
        orders: orders.map((o) => ({ id: o.id, number: o.number, status: o.status, table: o.tableLabel, lines: o.lines, totalCents: o.totalCents, customerName: o.customerName, note: o.note, paid: !!o.paidAt, createdAt: o.createdAt.toISOString() })),
      };
    },
  },
  { method: "POST", path: "/table-orders/:id/status", handler: async (r) => { await needOrders(); return ok(await setOrderStatus(idOr404(r, "Commande introuvable."), str(r.body.status, 20))); } },
  { method: "POST", path: "/table-orders/:id/paid", handler: async (r) => { await needOrders(); return ok(await setOrderPaid(idOr404(r, "Commande introuvable."), bool(r.body.paid))); } },

  { method: "GET", path: "/menu", handler: menu },
  { method: "POST", path: "/menu/categories", handler: async (r) => { await needOrders(); ok(await saveCategory(null, str(r.body.name, 60))); return menu(); } },
  { method: "PATCH", path: "/menu/categories/:id", handler: async (r) => { await needOrders(); ok(await saveCategory(idOr404(r, "Rubrique introuvable."), str(r.body.name, 60))); return menu(); } },
  { method: "DELETE", path: "/menu/categories/:id", handler: async (r) => { await needOrders(); ok(await deleteCategory(idOr404(r, "Rubrique introuvable."))); return menu(); } },
  { method: "PATCH", path: "/menu/categories/:id/move", handler: async (r) => { await needOrders(); ok(await moveCategory(idOr404(r, "Rubrique introuvable."), r.body.direction === "up" ? -1 : 1)); return menu(); } },
  { method: "POST", path: "/menu/items", handler: async (r) => { await saveItem(r, null); return menu(); } },
  { method: "PATCH", path: "/menu/items/:id", handler: async (r) => { await saveItem(r, idOr404(r, "Plat introuvable.")); return menu(); } },
  { method: "DELETE", path: "/menu/items/:id", handler: async (r) => { await needOrders(); ok(await deleteMenuItem(idOr404(r, "Plat introuvable."))); return menu(); } },
  { method: "POST", path: "/menu/items/:id/available", handler: async (r) => { await needOrders(); ok(await setItemAvailable(idOr404(r, "Plat introuvable."), bool(r.body.available))); return menu(); } },

  {
    method: "GET",
    path: "/tables",
    handler: async () => {
      const ctx = await needOrders();
      const origin = tableOrigin();
      const tables = await tablesOf(ctx.business.id);
      return { canEdit: canEdit(ctx), tables: tables.map((t) => ({ id: t.id, label: t.label, url: `${origin}/t/${t.token}` })) };
    },
  },
  {
    method: "POST",
    path: "/tables",
    handler: async (r) => {
      await needOrders();
      return ok(await addTables({ prefix: str(r.body.prefix, 30), from: Math.round(Number(r.body.from) || 1), count: Math.round(Number(r.body.count) || 1) }));
    },
  },
  { method: "PATCH", path: "/tables/:id", handler: async (r) => { await needOrders(); return ok(await renameTable(idOr404(r, "Table introuvable."), str(r.body.label, 40))); } },
  { method: "POST", path: "/tables/:id/regenerate", handler: async (r) => { await needOrders(); return ok(await regenerateTable(idOr404(r, "Table introuvable."))); } },
  { method: "DELETE", path: "/tables/:id", handler: async (r) => { await needOrders(); return ok(await deleteTable(idOr404(r, "Table introuvable."))); } },
];
