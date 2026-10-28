import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { posSessions } from "@/db/schema";
import { PrintToolbar } from "@/components/invoicing/print-toolbar";
import { requireContext } from "@/server/context";
import { sessionTotals } from "@/server/stock";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Rapport Z" }, robots: { index: false } };
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);

/** Rapport de clôture (Z) : ventes par moyen de paiement, TVA, espèces attendues et comptées. */
export default async function PrintZ({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await requireContext();
  const [s] = await db.select().from(posSessions).where(and(eq(posSessions.id, id), eq(posSessions.businessId, ctx.business.id)));
  if (!s) notFound();
  const t = await sessionTotals(ctx.business.id, s.id);
  const fmt = new Intl.DateTimeFormat("fr-BE", { timeZone: ctx.business.timezone || "Europe/Brussels", dateStyle: "short", timeStyle: "short" });
  const row = (l: string, v: string, b = false) => <p className={`flex justify-between ${b ? "font-bold" : ""}`}><span>{l}</span><span>{v}</span></p>;
  return (
    <div className="min-h-dvh bg-surface-muted py-6 print:bg-white print:py-0">
      <style>{`@page { size: 80mm auto; margin: 4mm; } @media print { html, body { background: #fff; } }`}</style>
      <PrintToolbar />
      <div className="mx-auto w-[302px] bg-white p-4 font-mono text-[12px] leading-snug text-black shadow-sm print:w-full print:p-0 print:shadow-none">
        <p className="text-center text-[14px] font-bold">{ctx.business.name}</p>
        <p className="text-center font-bold">RAPPORT DE CLÔTURE (Z)</p>
        <p className="mt-2">Ouverture : {fmt.format(s.openedAt)}</p>
        <p>Clôture : {s.closedAt ? fmt.format(s.closedAt) : "caisse ouverte"}</p>
        <div className="my-2 border-t border-dashed border-black" />
        {row("Tickets", String(t.tickets))}
        {row("Espèces", eur(t.cash))}
        {row("Carte", eur(t.card))}
        {t.other ? row("Autre", eur(t.other)) : null}
        {row("TOTAL TVAC", eur(t.total), true)}
        {row("dont TVA", eur(t.vat))}
        {t.refunded ? row("Remboursements", eur(t.refunded)) : null}
        <div className="my-2 border-t border-dashed border-black" />
        {row("Fond de caisse", eur(s.openingCashCents))}
        {row("Espèces attendues", eur(s.expectedCashCents ?? s.openingCashCents + t.cash))}
        {s.countedCashCents != null ? row("Espèces comptées", eur(s.countedCashCents)) : null}
        {s.countedCashCents != null && s.expectedCashCents != null ? row("Écart", eur(s.countedCashCents - s.expectedCashCents), true) : null}
        {s.note ? <p className="mt-2">Note : {s.note}</p> : null}
      </div>
    </div>
  );
}
