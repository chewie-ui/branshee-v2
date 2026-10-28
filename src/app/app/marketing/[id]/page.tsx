import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { campaignRecipients, campaigns } from "@/db/schema";
import { CampaignEditor } from "@/components/marketing/campaign-editor";
import { requireContext } from "@/server/context";
import { audienceCount, marketingRights } from "@/server/marketing";

export const metadata: Metadata = { title: "Campagne" };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  if (!marketingRights(ctx).manage) redirect("/app/acces-refuse");
  const { id } = await params;
  if (id === "nouvelle") return <CampaignEditor initial={null} stats={null} initialCount={await audienceCount(ctx.business.id, { type: "all", days: 180 })} />;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [c] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.businessId, ctx.business.id)));
  if (!c) notFound();
  const [s] = await db.select({ sent: sql<number>`count(*) filter (where status = 'sent')::int`, pending: sql<number>`count(*) filter (where status = 'pending')::int`, failed: sql<number>`count(*) filter (where status = 'failed')::int`, unsub: sql<number>`count(unsubscribed_at)::int` }).from(campaignRecipients).where(eq(campaignRecipients.campaignId, c.id));
  return <CampaignEditor initial={{ id: c.id, subject: c.subject, body: c.body, audience: c.audience, status: c.status, recipients: c.recipients }} stats={c.status === "draft" ? null : (s ?? null)} initialCount={c.status === "draft" ? await audienceCount(ctx.business.id, c.audience) : c.recipients} />;
}
