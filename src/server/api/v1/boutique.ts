import "server-only";
import { headers } from "next/headers";
import { cancelShopOrder, markShopOrderPaid, saveShopSettings, setShopOrderStatus } from "@/server/actions/shop";
import { bool, fail, forbidden, has, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { currentContext, type AppContext } from "@/server/context";
import { isLocked } from "@/server/plan";
import { shopOrdersOf, shopOrigin, shopRights, shopSettingsOf } from "@/server/shop";

/** API mobile de l'app Boutique (Skydev) : commandes en ligne (préparer, expédier, encaisser, annuler) et réglages. */

async function needShop(): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("boutique")) return forbidden();
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
const idOr404 = (r: ApiRequest) => (uuid(r.params.id) ? r.params.id! : fail(404, "not_found", "Commande introuvable."));
const euros = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));

async function settings() {
  const ctx = await needShop();
  const s = await shopSettingsOf(ctx.business.id);
  return {
    canManage: shopRights(ctx).manage,
    url: `${shopOrigin()}/boutique/${ctx.business.slug}`,
    settings: { enabled: s.enabled, pickup: s.pickup, pickupNote: s.pickupNote ?? "", delivery: s.delivery, deliveryPrice: euros(s.deliveryCents), freeFrom: euros(s.freeDeliveryFromCents), deliveryNote: s.deliveryNote ?? "", payOnline: s.payOnline, payOnPickup: s.payOnPickup, payTransfer: s.payTransfer, intro: s.intro ?? "" },
  };
}

export const boutiqueRoutes: Route[] = [
  {
    method: "GET",
    path: "/shop/orders",
    handler: async () => {
      const ctx = await needShop();
      const [s, orders] = await Promise.all([shopSettingsOf(ctx.business.id), shopOrdersOf(ctx.business.id)]);
      return {
        enabled: s.enabled,
        url: `${shopOrigin()}/boutique/${ctx.business.slug}`,
        canManage: shopRights(ctx).manage,
        orders: orders.map((o) => ({ id: o.id, number: o.number, status: o.status, payMethod: o.payMethod, paid: !!o.paidAt, fulfilment: o.fulfilment, name: o.name, email: o.email, phone: o.phone, address: o.address, note: o.note, lines: o.lines, totalCents: o.totalCents, itemsCents: o.itemsCents, deliveryCents: o.deliveryCents, createdAt: o.createdAt.toISOString() })),
      };
    },
  },
  { method: "POST", path: "/shop/orders/:id/status", handler: async (r) => { await needShop(); return ok(await setShopOrderStatus(idOr404(r), str(r.body.status, 20))); } },
  { method: "POST", path: "/shop/orders/:id/paid", handler: async (r) => { await needShop(); return ok(await markShopOrderPaid(idOr404(r))); } },
  { method: "POST", path: "/shop/orders/:id/cancel", handler: async (r) => { await needShop(); return ok(await cancelShopOrder(idOr404(r))); } },
  { method: "GET", path: "/shop/settings", handler: settings },
  {
    method: "PATCH",
    path: "/shop/settings",
    handler: async (r) => {
      const cur = (await settings()).settings;
      const b = r.body;
      const pickB = (k: keyof typeof cur) => (has(b, k) ? bool(b[k]) : (cur[k] as boolean));
      const pickS = (k: keyof typeof cur, max: number) => (has(b, k) ? str(b[k], max) : (cur[k] as string));
      const res = ok(
        await saveShopSettings({
          enabled: pickB("enabled"),
          pickup: pickB("pickup"),
          pickupNote: pickS("pickupNote", 300),
          delivery: pickB("delivery"),
          deliveryPrice: pickS("deliveryPrice", 12),
          freeFrom: pickS("freeFrom", 12),
          deliveryNote: pickS("deliveryNote", 300),
          payOnline: pickB("payOnline"),
          payOnPickup: pickB("payOnPickup"),
          payTransfer: pickB("payTransfer"),
          intro: pickS("intro", 500),
        }),
      );
      return { ...(await settings()), message: res.message };
    },
  },
];
