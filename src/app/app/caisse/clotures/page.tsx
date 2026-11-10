import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { requireContext } from "@/server/context";
import { sessionsOf } from "@/server/stock";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";
import { intlLocale } from "@/lib/i18n/app";

export const generateMetadata = appMetadata("Clôtures de caisse");
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);

export default async function ClosingsPage({ searchParams }: { searchParams: Promise<{ z?: string }> }) {
  const t = await appT();
  const ctx = await requireContext();
  const z = (await searchParams).z;
  const rows = await sessionsOf(ctx.business.id);
  const fmt = new Intl.DateTimeFormat(intlLocale(t.locale), { timeZone: ctx.business.timezone || "Europe/Brussels", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <>
      <PageHeader title={t("Clôtures")} description={t("Chaque ouverture et fermeture de caisse, avec le rapport Z.")} />
      {z && rows.some((r) => r.s.id === z) ? <p className="mb-4 rounded-lg bg-success-soft px-3 py-2 text-sm text-success" role="status">{t("Caisse clôturée.")} <a href={`/imprimer/z/${z}`} target="_blank" rel="noopener" className="font-medium underline">{t("Imprimer le rapport Z")}</a></p> : null}
      {rows.length === 0 ? <Card className="p-8 text-center text-sm text-muted">{t("La caisse n'a pas encore été ouverte.")}</Card> : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {rows.map(({ s, opener }) => {
              const diff = s.countedCashCents != null && s.expectedCashCents != null ? s.countedCashCents - s.expectedCashCents : null;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                  <span className="min-w-0 flex-1"><span className="font-medium">{fmt.format(s.openedAt)}</span><span className="text-muted">{s.closedAt ? ` → ${fmt.format(s.closedAt)}` : " · ouverte"}{opener ? ` · ${opener}` : ""}</span></span>
                  {diff !== null ? <span className={cn("rounded px-1.5 text-xs font-medium", diff === 0 ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>{diff === 0 ? t("Compte juste") : `Écart ${eur(diff)}`}</span> : null}
                  {s.closedAt ? <a href={`/imprimer/z/${s.id}`} target="_blank" rel="noopener" className="text-sm font-medium text-accent hover:text-accent-hover">{t("Rapport Z")}</a> : null}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
