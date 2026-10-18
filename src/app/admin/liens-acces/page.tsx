import type { Metadata } from "next";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { accessLinks } from "@/db/schema";
import { AccessLinkActions, AccessLinkForm } from "@/components/admin/platform";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatDay } from "@/lib/time";
import { requireSuperadmin } from "@/server/admin";

export const metadata: Metadata = { title: "Liens d'accès" };

/** Liens qui offrent un forfait pendant N jours (partenariats, tests, gestes commerciaux). */
export default async function AdminAccessLinks() {
  await requireSuperadmin();
  const links = await db
    .select({ l: accessLinks, lastUse: sql<Date | null>`(select max(used_at) from access_link_uses u where u.access_link_id = ${accessLinks.id})` })
    .from(accessLinks)
    .orderBy(desc(accessLinks.createdAt));
  const base = (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");
  const now = new Date();
  return (
    <>
      <PageHeader title="Liens d'accès" description="La personne qui ouvre le lien (connectée) choisit l'établissement qui reçoit le forfait offert." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Nouveau lien" />
          <AccessLinkForm />
        </Card>
        <Card>
          <CardHeader title={`Liens (${links.length})`} />
          <ul className="divide-y divide-border">
            {links.map(({ l, lastUse }) => {
              const expired = !!l.expiresAt && l.expiresAt < now;
              const full = l.usedCount >= l.maxUses;
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1 basis-64">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{l.label || "Sans libellé"}</span>
                      {!l.isActive ? <Badge>Inactif</Badge> : expired ? <Badge tone="warning">Expiré</Badge> : full ? <Badge tone="warning">Épuisé</Badge> : <Badge tone="success">Actif</Badge>}
                    </span>
                    <span className="block text-sm text-muted">
                      {l.plan === "pro_plus" ? "Pro+" : "Pro"} pendant {l.durationDays} jours · {l.usedCount}/{l.maxUses} utilisation{l.maxUses > 1 ? "s" : ""}
                      {l.expiresAt ? ` · valable jusqu'au ${formatDay(l.expiresAt, "Europe/Brussels", "d MMM yyyy")}` : ""}
                      {lastUse ? ` · dernière le ${formatDay(new Date(lastUse), "Europe/Brussels", "d MMM yyyy")}` : ""}
                    </span>
                    <span className="block truncate font-mono text-xs text-muted">{base}/acces/{l.code}</span>
                  </span>
                  <AccessLinkActions id={l.id} url={`${base}/acces/${l.code}`} active={l.isActive} />
                </li>
              );
            })}
            {links.length === 0 ? <li className="px-5 py-4 text-sm text-muted">Aucun lien.</li> : null}
          </ul>
        </Card>
      </div>
    </>
  );
}
