"use server";

import { cookies, headers } from "next/headers";
import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { businesses, customers, loyaltyCards, loyaltyMoves, loyaltyQrUses, shopOrders } from "@/db/schema";
import { clientIp } from "@/lib/client-ip";
import { qrVerify } from "@/lib/loyalty-qr";
import { rateLimit } from "@/server/auth/rate-limit";
import { getSessionUser } from "@/server/auth/session";
import { customerByEmail, giveStamp, loyaltyQrKey, loyaltySettingsOf, sendLoyaltyWelcome, joinLoyaltyByEmail } from "@/server/loyalty";
import { isLocked } from "@/server/plan";

export type ScanResult =
  | { ok: true; stamps: number; goal: number; reward: string; already: boolean; token: string | null; business: string }
  | { ok: false; need: "identify"; business: string; goal: number; reward: string }
  | { ok: false; error: string };

const USED = "Ce QR code vient d'être utilisé. Demandez au commerçant le nouveau code affiché sur son écran.";
const cookieName = (businessId: string) => `loy_${businessId.replace(/-/g, "").slice(0, 12)}`;
const who = z.object({
  firstName: z.string().trim().min(1, "Indiquez votre prénom.").max(60),
  lastName: z.string().trim().max(80),
  email: z.email("Adresse email invalide.").max(200),
});

/**
 * Le client scanne le QR code affiché par le pro : tampon sur sa carte. Le QR change toutes les 30 secondes,
 * il faut donc être sur place. Le client est reconnu par son téléphone (cookie), son compte client, ou son
 * email la première fois. Un seul tampon par jour.
 */
export async function scanStamp(input: { b: string; w: number; n?: number; s: string; firstName?: string; lastName?: string; email?: string }): Promise<ScanResult> {
  const n = Number(input.n ?? 0) || 0;
  if (!z.uuid().safeParse(input.b).success || !qrVerify(loyaltyQrKey(), input.b, Number(input.w), String(input.s ?? ""), Date.now(), n)) return { ok: false, error: "Ce QR code a expiré. Demandez à le scanner à nouveau." };
  const sig = String(input.s);
  const [spent] = await db.select({ sig: loyaltyQrUses.sig }).from(loyaltyQrUses).where(eq(loyaltyQrUses.sig, sig));
  if (spent) return { ok: false, error: USED };
  const ip = clientIp(await headers()) ?? "?";
  if (!rateLimit(`loyalty-scan:${ip}`, 30, 3600_000).ok) return { ok: false, error: "Trop de tentatives. Réessayez plus tard." };
  const [b] = await db.select({ id: businesses.id, name: businesses.name, tz: businesses.timezone }).from(businesses).where(and(eq(businesses.id, input.b), isNull(businesses.deletedAt)));
  if (!b) return { ok: false, error: "Ce QR code n'est plus valable." };
  const s = await loyaltySettingsOf(b.id);
  if (!s.qrEnabled || (await isLocked(b.id))) return { ok: false, error: `${b.name} n'utilise pas le tampon par QR code pour le moment.` };

  const jar = await cookies();
  let customerId: string | null = null;
  let email: string | null = null;
  // Carte déjà sur ce téléphone, ou fiche déjà créée ici même : on peut montrer la carte.
  let showCard = true;
  const saved = jar.get(cookieName(b.id))?.value;
  if (saved && /^[\w-]{16,40}$/.test(saved)) {
    const [card] = await db.select({ customerId: loyaltyCards.customerId }).from(loyaltyCards).where(and(eq(loyaltyCards.businessId, b.id), eq(loyaltyCards.token, saved)));
    customerId = card?.customerId ?? null;
  }
  if (!customerId) {
    const session = await getSessionUser();
    if (session?.user.emailVerifiedAt) {
      const u = session.user;
      const [c] = await db.select({ id: customers.id, email: customers.email }).from(customers).where(and(eq(customers.businessId, b.id), or(eq(customers.userId, u.id), sql`lower(${customers.email}) = ${u.email.toLowerCase()}`))).limit(1);
      const row = c ?? (await customerByEmail(b.id, { email: u.email, firstName: u.fullName.split(" ")[0] ?? "", lastName: u.fullName.split(" ").slice(1).join(" "), userId: u.id }));
      customerId = row?.id ?? null;
      email = row?.email ?? u.email;
    }
  }
  // Première fois, sans compte ni email : carte créée tout de suite sur ce téléphone (pas d'attente au comptoir).
  // Le client ajoute son email ou crée son compte plus tard, depuis sa carte, pour ne pas la perdre.
  if (!customerId && !input.email) {
    const [anon] = await db.insert(customers).values({ businessId: b.id, fullName: "Client fidélité (sans email)" }).returning({ id: customers.id });
    customerId = anon!.id;
  }
  if (!customerId) {
    const v = who.safeParse({ firstName: input.firstName ?? "", lastName: input.lastName ?? "", email: input.email });
    if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez vos informations." };
    const [existing] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.businessId, b.id), sql`lower(${customers.email}) = ${v.data.email.toLowerCase()}`));
    const row = existing ?? (await customerByEmail(b.id, v.data));
    if (!row) return { ok: false, error: "Réessayez dans un instant." };
    customerId = row.id;
    email = v.data.email;
    // Email d'une fiche qui existait déjà : on tamponne, mais la carte est envoyée par email (pas affichée à
    // quelqu'un qui aurait juste tapé l'adresse d'un autre).
    showCard = !existing;
  }

  // Le code ne sert qu'une fois : on le réserve avant de tamponner (deux scans en même temps : un seul passe).
  const claimed = await db.insert(loyaltyQrUses).values({ sig, businessId: b.id, window: Number(input.w) }).onConflictDoNothing().returning({ sig: loyaltyQrUses.sig });
  if (!claimed.length) return { ok: false, error: USED };
  const r = await giveStamp({ businessId: b.id, timezone: b.tz, customerId, source: "qr" });
  // Déjà tamponné aujourd'hui : le code reste disponible pour le client suivant.
  if (!r.ok) await db.delete(loyaltyQrUses).where(eq(loyaltyQrUses.sig, sig));
  // Ménage : les codes de plus de 2 jours ne servent plus à rien.
  await db.delete(loyaltyQrUses).where(lt(loyaltyQrUses.usedAt, new Date(Date.now() - 2 * 86400_000))).catch(() => {});
  const [card] = await db.select({ stamps: loyaltyCards.stamps, token: loyaltyCards.token }).from(loyaltyCards).where(and(eq(loyaltyCards.businessId, b.id), eq(loyaltyCards.customerId, customerId)));
  if (!card) return { ok: false, error: "Réessayez dans un instant." };
  if (r.ok && (r.first || !showCard)) await sendLoyaltyWelcome(b.id, b.name, email, card.token, s.goal, s.reward, card.stamps);
  if (showCard) jar.set(cookieName(b.id), card.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/fidelite", maxAge: 400 * 86400 });
  return { ok: true, stamps: card.stamps, goal: s.goal, reward: s.reward, already: !r.ok, token: showCard ? card.token : null, business: b.name };
}

const claimSchema = z.object({
  token: z.string().regex(/^[\w-]{16,40}$/),
  firstName: z.string().trim().min(1, "Indiquez votre prénom.").max(60),
  email: z.email("Adresse email invalide.").max(200),
});

/**
 * Carte créée sans email au premier scan : le client y ajoute son prénom et son email quand il veut, pour la
 * retrouver s'il change de téléphone. Email déjà connu de ce commerce : les tampons sont ajoutés à cette carte,
 * dont le lien part par email (jamais affiché à quelqu'un qui aurait juste tapé l'adresse d'un autre).
 */
export async function claimLoyaltyCard(input: { token: string; firstName: string; email: string }): Promise<{ ok: true; merged: boolean } | { ok: false; error: string }> {
  const v = claimSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez vos informations." };
  const ip = clientIp(await headers()) ?? "?";
  if (!rateLimit(`loyalty-claim:${ip}`, 10, 3600_000).ok) return { ok: false, error: "Trop de tentatives. Réessayez plus tard." };
  const email = v.data.email.toLowerCase();
  const [card] = await db.select({ id: loyaltyCards.id, businessId: loyaltyCards.businessId, customerId: loyaltyCards.customerId, stamps: loyaltyCards.stamps, custEmail: customers.email, bName: businesses.name, tz: businesses.timezone }).from(loyaltyCards).innerJoin(customers, eq(customers.id, loyaltyCards.customerId)).innerJoin(businesses, eq(businesses.id, loyaltyCards.businessId)).where(eq(loyaltyCards.token, v.data.token));
  if (!card) return { ok: false, error: "Carte introuvable." };
  if (card.custEmail) return { ok: false, error: "Cette carte est déjà liée à une adresse email." };
  const s = await loyaltySettingsOf(card.businessId);
  const [other] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.businessId, card.businessId), sql`lower(${customers.email}) = ${email}`));
  if (!other) {
    await db.update(customers).set({ email, firstName: v.data.firstName, fullName: v.data.firstName, updatedAt: new Date() }).where(eq(customers.id, card.customerId));
    const [c] = await db.select({ token: loyaltyCards.token, stamps: loyaltyCards.stamps }).from(loyaltyCards).where(eq(loyaltyCards.id, card.id));
    await sendLoyaltyWelcome(card.businessId, card.bName, email, c!.token, s.goal, s.reward, c!.stamps);
    return { ok: true, merged: false };
  }
  // Fusion : tampons et historique rejoignent la carte existante, la carte sans email disparaît.
  const target = await db.transaction(async (tx) => {
    await tx.insert(loyaltyCards).values({ businessId: card.businessId, customerId: other.id, token: (await import("node:crypto")).randomBytes(16).toString("base64url") }).onConflictDoNothing();
    const [t] = await tx.select().from(loyaltyCards).where(and(eq(loyaltyCards.businessId, card.businessId), eq(loyaltyCards.customerId, other.id))).for("update");
    const [a] = await tx.select().from(loyaltyCards).where(eq(loyaltyCards.id, card.id)).for("update");
    if (!t || !a) return null;
    const last = [t.lastStampAt, a.lastStampAt].filter(Boolean).sort((x, y) => y!.getTime() - x!.getTime())[0] ?? null;
    // Anti-fraude : plusieurs cartes sans email (téléphones, navigateurs privés…) réunies sur une même adresse ne
    // donnent jamais plus d'un tampon QR ou rendez-vous par jour. Les tampons en double sont annulés.
    const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: card.tz || "Europe/Brussels" }).format(d);
    const auto = (src: string) => src === "qr" || src === "appointment";
    const tMoves = await tx.select({ at: loyaltyMoves.createdAt, source: loyaltyMoves.source }).from(loyaltyMoves).where(and(eq(loyaltyMoves.cardId, t.id), eq(loyaltyMoves.kind, "stamp"), gt(loyaltyMoves.delta, 0)));
    const days = new Set(tMoves.filter((m) => auto(m.source)).map((m) => day(m.at)));
    const aMoves = await tx.select({ id: loyaltyMoves.id, at: loyaltyMoves.createdAt, source: loyaltyMoves.source, delta: loyaltyMoves.delta }).from(loyaltyMoves).where(and(eq(loyaltyMoves.cardId, a.id), eq(loyaltyMoves.kind, "stamp"), gt(loyaltyMoves.delta, 0))).orderBy(loyaltyMoves.createdAt);
    let dropped = 0;
    for (const m of aMoves) {
      if (!auto(m.source)) continue;
      const d = day(m.at);
      if (!days.has(d)) { days.add(d); continue; }
      dropped += m.delta;
      await tx.update(loyaltyMoves).set({ delta: 0, kind: "fix" }).where(eq(loyaltyMoves.id, m.id));
    }
    const kept = Math.max(0, a.stamps - dropped);
    await tx.update(loyaltyMoves).set({ cardId: t.id }).where(eq(loyaltyMoves.cardId, a.id));
    await tx.update(loyaltyCards).set({ stamps: t.stamps + kept, rewardsEarned: t.rewardsEarned + a.rewardsEarned, lastStampAt: last, updatedAt: new Date() }).where(eq(loyaltyCards.id, t.id));
    await tx.delete(loyaltyCards).where(eq(loyaltyCards.id, a.id));
    await tx.delete(customers).where(and(eq(customers.id, card.customerId), isNull(customers.email)));
    return { token: t.token, stamps: t.stamps + kept };
  });
  if (!target) return { ok: false, error: "Réessayez dans un instant." };
  await sendLoyaltyWelcome(card.businessId, card.bName, email, target.token, s.goal, s.reward, target.stamps);
  (await cookies()).delete({ name: cookieName(card.businessId), path: "/fidelite" });
  return { ok: true, merged: true };
}

/** Depuis la page d'une commande (le lien secret de la commande suffit) : rejoindre la carte de fidélité du commerce. */
export async function joinLoyaltyFromOrder(orderToken: string): Promise<{ ok: true; token: string | null; added: number } | { ok: false; error: string }> {
  if (!/^[\w-]{16,40}$/.test(orderToken)) return { ok: false, error: "Commande introuvable." };
  const ip = clientIp(await headers());
  if (!rateLimit(`loyalty-join:${ip}`, 20, 3600_000).ok) return { ok: false, error: "Trop de tentatives. Réessayez plus tard." };
  const [o] = await db.select({ businessId: shopOrders.businessId, email: shopOrders.email, name: shopOrders.name, phone: shopOrders.phone, status: shopOrders.status }).from(shopOrders).where(eq(shopOrders.token, orderToken));
  if (!o || o.status === "cancelled") return { ok: false, error: "Commande introuvable." };
  if (await isLocked(o.businessId)) return { ok: false, error: "Ce commerce ne propose pas la fidélité pour le moment." };
  const u = (await getSessionUser())?.user;
  // L'email d'une commande n'est pas vérifié : le lien de la carte n'est montré qu'au compte vérifié de cette adresse.
  // Sinon il part par email (quelqu'un qui commande avec l'adresse d'un autre ne voit jamais sa carte).
  const mine = !!u?.emailVerifiedAt && u.email.toLowerCase() === o.email.toLowerCase();
  const r = await joinLoyaltyByEmail(o.businessId, { email: o.email, name: o.name, phone: o.phone, userId: mine ? u!.id : null });
  if (!r.ok) return r;
  if (mine) return { ok: true, token: r.token, added: r.added };
  if (r.existed) {
    const [b] = await db.select({ name: businesses.name }).from(businesses).where(eq(businesses.id, o.businessId));
    const s = await loyaltySettingsOf(o.businessId);
    await sendLoyaltyWelcome(o.businessId, b?.name ?? "", o.email, r.token, s.goal, s.reward, r.stamps);
  }
  return { ok: true, token: null, added: r.added };
}

/** Depuis l'espace client (email vérifié) : rejoindre la carte d'un commerce où l'on a déjà commandé. */
export async function joinLoyaltyAsClient(businessId: string): Promise<{ ok: true; token: string; added: number } | { ok: false; error: string }> {
  if (!z.uuid().safeParse(businessId).success) return { ok: false, error: "Commerce introuvable." };
  const u = (await getSessionUser())?.user;
  if (!u || !u.emailVerifiedAt) return { ok: false, error: "Connectez-vous avec une adresse vérifiée." };
  const [o] = await db.select({ name: shopOrders.name, phone: shopOrders.phone }).from(shopOrders).where(and(eq(shopOrders.businessId, businessId), sql`lower(${shopOrders.email}) = ${u.email.toLowerCase()}`)).limit(1);
  if (!o) return { ok: false, error: "Aucune commande chez ce commerce avec votre adresse." };
  if (await isLocked(businessId)) return { ok: false, error: "Ce commerce ne propose pas la fidélité pour le moment." };
  const r = await joinLoyaltyByEmail(businessId, { email: u.email, name: u.fullName || o.name, phone: o.phone, userId: u.id });
  return r.ok ? { ok: true, token: r.token, added: r.added } : r;
}
