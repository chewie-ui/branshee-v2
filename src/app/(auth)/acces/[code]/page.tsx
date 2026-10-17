import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { accessLinks, businesses } from "@/db/schema";
import { AccessLinkForm } from "@/components/auth/access-link-form";
import { Card } from "@/components/ui/card";
import { planLabel } from "@/lib/plans";
import { getSessionUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Accès offert" };
export const dynamic = "force-dynamic";

export default async function AccessLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [link] = await db.select().from(accessLinks).where(eq(accessLinks.code, code));
  const valid = link && link.isActive && (!link.expiresAt || link.expiresAt > new Date()) && link.usedCount < link.maxUses;
  if (!valid) {
    return (
      <Card className="p-6 text-center">
        <h1 className="text-xl font-semibold">Lien expiré</h1>
        <p className="mt-2 text-sm text-muted">Ce lien d&apos;accès n&apos;est plus valable.</p>
      </Card>
    );
  }
  const s = await getSessionUser();
  if (!s) redirect(`/inscription?suite=${encodeURIComponent(`/acces/${code}`)}`);
  const owned = await db.select({ id: businesses.id, name: businesses.name }).from(businesses).where(and(eq(businesses.ownerId, s.user.id), isNull(businesses.deletedAt)));
  return (
    <>
      <h1 className="text-center text-2xl font-semibold tracking-tight">Un cadeau pour vous</h1>
      <p className="mt-1 text-center text-sm text-muted">Forfait {planLabel(link.plan)} offert pendant {link.durationDays} jours{link.label ? ` — ${link.label}` : ""}.</p>
      <Card className="mt-6 p-6">
        {owned.length ? <AccessLinkForm code={code} businesses={owned} /> : <p className="text-sm text-muted">Créez d&apos;abord votre établissement, puis rouvrez ce lien. <Link href="/bienvenue" className="font-medium text-accent">Créer mon établissement</Link></p>}
      </Card>
    </>
  );
}
