import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { campaignRecipients, customers } from "@/db/schema";

/**
 * Désabonnement « en un clic » (RFC 8058) déclenché par Gmail, Outlook… via l'en-tête List-Unsubscribe-Post.
 * Un simple GET (antivirus, aperçu) ne désabonne pas : il renvoie vers la page avec le bouton.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{16,40}$/.test(token)) return new Response(null, { status: 404 });
  const [r] = await db.select({ id: campaignRecipients.id, customerId: campaignRecipients.customerId }).from(campaignRecipients).where(eq(campaignRecipients.token, token));
  if (!r) return new Response(null, { status: 404 });
  await db.update(campaignRecipients).set({ unsubscribedAt: sql`coalesce(${campaignRecipients.unsubscribedAt}, now())` }).where(eq(campaignRecipients.id, r.id));
  if (r.customerId) await db.update(customers).set({ marketingOptOutAt: new Date() }).where(and(eq(customers.id, r.customerId), isNull(customers.marketingOptOutAt)));
  return new Response(null, { status: 200 });
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return Response.redirect(new URL(`/desabonnement/${(await params).token}`, req.url), 303);
}
