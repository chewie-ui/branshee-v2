import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { supportThreads } from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";
import { supportLive } from "@/server/support";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Chat de support du pro, rafraîchi en direct (toutes les 2–3 s quand il est ouvert).
 * `?peek=1` : seulement « discussion en cours ? » et le nombre de messages non lus (bouton flottant).
 * `?since=<date>` : messages depuis cette date ; `?read=1` : le pro a la discussion sous les yeux.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "auth" }, { status: 401, headers: NO_STORE });
  const sp = req.nextUrl.searchParams;
  if (sp.get("peek")) {
    const [t] = await db.select({ closedAt: supportThreads.closedAt, unread: supportThreads.unreadByUser }).from(supportThreads).where(eq(supportThreads.userId, session.user.id));
    return NextResponse.json({ active: !!t && !t.closedAt, unread: t?.unread ?? 0 }, { headers: NO_STORE });
  }
  const since = sp.get("since");
  const d = since ? new Date(since) : null;
  const data = await supportLive(session.user.id, "user", { since: d && !isNaN(d.getTime()) ? d : null, markRead: sp.get("read") === "1" && !session.impersonatedById });
  return NextResponse.json(data, { headers: NO_STORE });
}
