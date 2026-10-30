"use server";

import { cookies, headers } from "next/headers";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { businesses, customers, loyaltyCards } from "@/db/schema";
import { clientIp } from "@/lib/client-ip";
import { qrVerify } from "@/lib/loyalty-qr";
import { rateLimit } from "@/server/auth/rate-limit";
import { getSessionUser } from "@/server/auth/session";
import { customerByEmail, giveStamp, loyaltyQrKey, loyaltySettingsOf, sendLoyaltyWelcome } from "@/server/loyalty";
import { isLocked } from "@/server/plan";

export type ScanResult =
  | { ok: true; stamps: number; goal: number; reward: string; already: boolean; token: string | null; business: string }
  | { ok: false; need: "identify"; business: string; goal: number; reward: string }
  | { ok: false; error: string };

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
export async function scanStamp(input: { b: string; w: number; s: string; firstName?: string; lastName?: string; email?: string }): Promise<ScanResult> {
  if (!z.uuid().safeParse(input.b).success || !qrVerify(loyaltyQrKey(), input.b, Number(input.w), String(input.s ?? ""))) return { ok: false, error: "Ce QR code a expiré. Demandez à le scanner à nouveau." };
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
  if (!customerId) {
    if (!input.email) return { ok: false, need: "identify", business: b.name, goal: s.goal, reward: s.reward };
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

  const r = await giveStamp({ businessId: b.id, timezone: b.tz, customerId, source: "qr" });
  const [card] = await db.select({ stamps: loyaltyCards.stamps, token: loyaltyCards.token }).from(loyaltyCards).where(and(eq(loyaltyCards.businessId, b.id), eq(loyaltyCards.customerId, customerId)));
  if (!card) return { ok: false, error: "Réessayez dans un instant." };
  if (r.ok && (r.first || !showCard)) await sendLoyaltyWelcome(b.id, b.name, email, card.token, s.goal, s.reward, card.stamps);
  if (showCard) jar.set(cookieName(b.id), card.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/fidelite", maxAge: 400 * 86400 });
  return { ok: true, stamps: card.stamps, goal: s.goal, reward: s.reward, already: !r.ok, token: showCard ? card.token : null, business: b.name };
}
