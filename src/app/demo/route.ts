import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { clientIp } from "@/lib/client-ip";
import { rateLimit } from "@/server/auth/rate-limit";
import { BUSINESS_COOKIE, createSession, getSessionUser } from "@/server/auth/session";
import { currentBrand } from "@/server/brand";
import { ensureDemo } from "@/server/demo";

const origin = () => (process.env.SKYDEV_APP_URL ?? process.env.APP_URL ?? "https://skydev.be").replace(/\/$/, "");

/**
 * « Voir la démo » : ouvre le compte de démonstration (lecture seule) sans inscription.
 * Déjà connecté avec un vrai compte : on ne touche pas à sa session.
 */
export async function GET(req: NextRequest) {
  if ((await currentBrand()).id !== "skydev") return NextResponse.redirect(`${origin()}/`);
  const me = await getSessionUser();
  if (me && !me.user.isDemo) return NextResponse.redirect(`${origin()}/app`);
  const h = await headers();
  if (!me && !rateLimit(`demo:${clientIp(h) ?? "?"}`, 20, 3600_000).ok) return NextResponse.redirect(`${origin()}/?demo=plus-tard`);
  const { userId, businessId } = await ensureDemo();
  if (!me) await createSession(userId, { userAgent: h.get("user-agent"), ip: clientIp(h) });
  const res = NextResponse.redirect(`${origin()}${req.nextUrl.searchParams.get("app") === "rdv" ? "/app/agenda" : "/app"}`);
  res.cookies.set(BUSINESS_COOKIE, businessId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 86400 });
  return res;
}
