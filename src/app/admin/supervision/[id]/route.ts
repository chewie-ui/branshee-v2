import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, businesses, supervisionRequests } from "@/db/schema";
import { getSessionUser, startImpersonation } from "@/server/auth/session";
import { absoluteUrl } from "@/lib/app-url";

/** Ouvre la session supervisée une fois que le pro a accepté (lien à usage unique, 10 minutes). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSessionUser();
  if (!s?.user.isSuperadmin || s.impersonatedById) return new NextResponse("Introuvable", { status: 404 });
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Introuvable", { status: 404 });
  const [r] = await db
    .update(supervisionRequests)
    .set({ status: "closed" })
    .where(and(eq(supervisionRequests.id, id), eq(supervisionRequests.requestedById, s.user.id), eq(supervisionRequests.status, "accepted"), gt(supervisionRequests.expiresAt, new Date())))
    .returning({ userId: supervisionRequests.userId });
  if (!r) return NextResponse.redirect(absoluteUrl("/admin/utilisateurs?supervision=expiree"));
  await startImpersonation(r.userId, s.user.id);
  // Transparence : la session apparaît dans le journal de chaque établissement du pro.
  const owned = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, r.userId));
  if (owned.length)
    await db.insert(activityLogs).values(owned.map((b) => ({ businessId: b.id, userId: s.user.id, actorName: "Équipe Branshee", action: "admin.supervision", description: "Session de supervision ouverte par l'équipe Branshee (acceptée par le titulaire)" })));
  return NextResponse.redirect(absoluteUrl("/app"));
}
