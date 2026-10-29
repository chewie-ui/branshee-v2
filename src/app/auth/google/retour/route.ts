import { NextResponse, after, type NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { loginEvents, users } from "@/db/schema";
import { createSession, getSessionUser, setPendingTwoFactor } from "@/server/auth/session";
import { isPro, linkCustomerRecords } from "@/server/client-account";
import { exchangeCode, pushUpcomingToGoogle, readState, saveCalendarConnection } from "@/server/google";
import { linkInvitations } from "@/server/team";
import { clientIp } from "@/lib/client-ip";

const appUrl = () => (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");
const go = (path: string) => NextResponse.redirect(`${appUrl()}${path}`);

export async function GET(req: NextRequest) {
  const state = readState(req.nextUrl.searchParams.get("state") ?? "");
  const code = req.nextUrl.searchParams.get("code");
  if (!state || !code) return go("/connexion?google=erreur");
  let t: Awaited<ReturnType<typeof exchangeCode>>;
  try {
    t = await exchangeCode(code);
  } catch {
    return go(state.i === "calendar" ? "/app/reglages/integrations?google=erreur" : "/connexion?google=erreur");
  }

  // ── Google Agenda : le compte connecté doit être celui qui a lancé la demande ──
  if (state.i === "calendar") {
    const s = await getSessionUser();
    if (!s || s.user.id !== state.u) return go("/connexion");
    if (!t.refresh_token) return go("/app/reglages/integrations?google=refus");
    await saveCalendarConnection(s.user.id, t.info.email, t.refresh_token, t.scope);
    after(() => pushUpcomingToGoogle(s.user.id));
    return go("/app/reglages/integrations?google=ok");
  }

  // ── Connexion / inscription avec Google ──
  const info = t.info;
  if (!info.email_verified) return go("/connexion?google=email-non-verifie");
  const email = info.email.toLowerCase();
  let [user] = await db.select().from(users).where(eq(users.googleId, info.sub));
  if (!user) {
    [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`);
    if (user) await db.update(users).set({ googleId: info.sub, emailVerifiedAt: user.emailVerifiedAt ?? new Date() }).where(eq(users.id, user.id));
  }
  // Nouveau compte sans page de retour précise (bouton Google de l'inscription ou de la connexion) : c'est un pro
  // qui veut ses apps. Un client qui réserve chez un pro arrive avec une page de retour (son espace ou la page du pro).
  const created = !user;
  // Parrainage : code du parrain transmis par le bouton Google de l'inscription (?ref=).
  const [referrer] = !user && state.r ? await db.select({ id: users.id }).from(users).where(eq(users.referralCode, String(state.r))) : [];
  if (!user) [user] = await db.insert(users).values({ email, fullName: info.name?.slice(0, 120) || email, googleId: info.sub, emailVerifiedAt: new Date(), signupIntent: state.s ? "client" : "pro", referredById: referrer?.id ?? null }).returning();
  if (!user || user.disabledAt) return go("/connexion?google=desactive");
  await linkCustomerRecords(user.id, email);
  await linkInvitations(user.id, email);
  if (user.twoFactorSecret) {
    await setPendingTwoFactor(user.id, state.s || null);
    return go("/connexion/verification");
  }
  const h = await headers();
  const ip = (clientIp(h) ?? null);
  await createSession(user.id, { ip, userAgent: h.get("user-agent") });
  await db.insert(loginEvents).values({ userId: user.id, method: "google", ip });
  // Sans entreprise, un compte « pro » arrive sur la création de son entreprise (/app → /bienvenue).
  const pro = (await isPro(user.id)) || created || user.signupIntent === "pro";
  return go(state.s || (pro ? "/app" : "/espace-client"));
}
