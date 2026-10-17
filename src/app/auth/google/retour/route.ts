import { NextResponse, after, type NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { loginEvents, users } from "@/db/schema";
import { createSession, getSessionUser, setPendingTwoFactor } from "@/server/auth/session";
import { isPro, linkCustomerRecords } from "@/server/client-account";
import { exchangeCode, pushUpcomingToGoogle, readState, saveCalendarConnection } from "@/server/google";
import { linkInvitations } from "@/server/team";

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
  if (!user) [user] = await db.insert(users).values({ email, fullName: info.name?.slice(0, 120) || email, googleId: info.sub, emailVerifiedAt: new Date() }).returning();
  if (!user || user.disabledAt) return go("/connexion?google=desactive");
  await linkCustomerRecords(user.id, email);
  await linkInvitations(user.id, email);
  if (user.twoFactorSecret) {
    await setPendingTwoFactor(user.id, state.s || null);
    return go("/connexion/verification");
  }
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await createSession(user.id, { ip, userAgent: h.get("user-agent") });
  await db.insert(loginEvents).values({ userId: user.id, method: "google", ip });
  return go(state.s || ((await isPro(user.id)) ? "/app" : "/espace-client"));
}
