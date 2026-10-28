import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Megaphone, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { requireContext } from "@/server/context";
import { audienceCount, campaignsOf, dailyCap, marketingRights } from "@/server/marketing";

export const metadata: Metadata = { title: "Marketing" };
const STATUS: Record<string, [string, string]> = { draft: ["Brouillon", "bg-surface-muted text-muted"], sending: ["En cours d'envoi", "bg-accent-soft text-accent"], sent: ["Envoyée", "bg-success-soft text-success"] };

export default async function MarketingPage() {
  const ctx = await requireContext();
  if (!marketingRights(ctx).manage) redirect("/app/acces-refuse");
  const [list, reach, cap] = await Promise.all([campaignsOf(ctx.business.id), audienceCount(ctx.business.id, { type: "all", days: 30 }), dailyCap(ctx.business.id)]);
  const fmt = new Intl.DateTimeFormat("fr-BE", { timeZone: ctx.business.timezone || "Europe/Brussels", day: "numeric", month: "short", year: "numeric" });
  return (
    <>
      <PageHeader title="Marketing" description="Des emails à vos clients : nouveautés, offres, relance de ceux qu'on n'a pas vus depuis longtemps." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted"><span className="font-semibold text-text tabular-nums">{reach}</span> client{reach > 1 ? "s" : ""} joignable{reach > 1 ? "s" : ""} par email · jusqu&apos;à {cap.toLocaleString("fr-BE")} emails par jour{cap <= 50 ? " pendant l'essai" : ""}</p>
        <Link href="/app/marketing/nouvelle" className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-hover"><Plus className="size-4" aria-hidden="true" />Nouvelle campagne</Link>
      </div>
      {list.length === 0 ? (
        <Card className="p-8 text-center">
          <Megaphone className="mx-auto size-10 text-muted" aria-hidden="true" />
          <p className="mt-3 font-medium">Aucune campagne</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">Annoncez une nouveauté, une offre ou vos congés, ou relancez les clients pas revus depuis 6 mois. Chaque email contient un lien de désabonnement, comme la loi l&apos;exige.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {list.map(({ c, sent, unsub }) => {
              const [label, cls] = STATUS[c.status] ?? STATUS.draft!;
              return (
                <li key={c.id}>
                  <Link href={`/app/marketing/${c.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm hover:bg-surface-muted/60">
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{c.subject}</span><span className="block text-muted">{fmt.format(c.sentAt ?? c.queuedAt ?? c.createdAt)}{c.status !== "draft" ? ` · ${sent}/${c.recipients} envoyés${unsub ? ` · ${unsub} désabonnement${unsub > 1 ? "s" : ""}` : ""}` : ""}</span></span>
                    <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", cls)}>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
