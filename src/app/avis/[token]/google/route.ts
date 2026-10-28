import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reviewRequests } from "@/db/schema";
import { requestByToken } from "@/server/google-reviews";

/** Clic « Donner mon avis sur Google » : on note le clic puis on envoie vers la fiche Google. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const r = await requestByToken((await params).token);
  if (!r || !r.googleUrl) return Response.redirect(new URL(`/avis/${(await params).token}`, req.url), 302);
  if (!r.req.googleClickedAt) await db.update(reviewRequests).set({ googleClickedAt: new Date(), openedAt: r.req.openedAt ?? new Date() }).where(eq(reviewRequests.id, r.req.id));
  return new Response(null, { status: 302, headers: { Location: r.googleUrl, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
