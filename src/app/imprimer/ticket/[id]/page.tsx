import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { posSales } from "@/db/schema";
import { PrintToolbar } from "@/components/invoicing/print-toolbar";
import { PAY_METHODS, cartTotals } from "@/lib/stock";
import { requireContext } from "@/server/context";
import { getSellerSettings } from "@/server/invoicing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Ticket" }, robots: { index: false } };
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);

/** Ticket de caisse au format 80 mm (imprimante ticket) ou A4. */
export default async function PrintTicket({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await requireContext(undefined, { app: "caisse" });
  const [s] = await db.select().from(posSales).where(and(eq(posSales.id, id), eq(posSales.businessId, ctx.business.id)));
  if (!s) notFound();
  const seller = await getSellerSettings(ctx.business.id);
  const t = cartTotals(s.lines, s.discountCents);
  const when = new Intl.DateTimeFormat("fr-BE", { timeZone: ctx.business.timezone || "Europe/Brussels", dateStyle: "short", timeStyle: "short" }).format(s.createdAt);
  return (
    <div className="min-h-dvh bg-surface-muted py-6 print:bg-white print:py-0">
      <style>{`@page { size: 80mm auto; margin: 4mm; } @media print { html, body { background: #fff; } }`}</style>
      <PrintToolbar />
      <div className="mx-auto w-[302px] bg-white p-4 font-mono text-[12px] leading-snug text-black shadow-sm print:w-full print:p-0 print:shadow-none">
        <p className="text-center text-[14px] font-bold">{seller.tradeName || ctx.business.name}</p>
        {seller.street ? <p className="text-center">{seller.street}, {seller.zip} {seller.city}</p> : null}
        {seller.vatNumber ? <p className="text-center">TVA {seller.vatNumber}</p> : seller.bce ? <p className="text-center">BCE {seller.bce}</p> : null}
        <p className="mt-2 text-center">{s.number} · {when}</p>
        {s.status === "refunded" ? <p className="mt-1 text-center font-bold">*** REMBOURSÉ ***</p> : null}
        <div className="my-2 border-t border-dashed border-black" />
        {s.lines.map((l, i) => (
          <div key={i}>
            <p>{l.name}</p>
            <p className="flex justify-between"><span>{l.qty} × {eur(l.unitCents)}</span><span>{eur(l.qty * l.unitCents)}</span></p>
          </div>
        ))}
        {s.discountCents ? <p className="flex justify-between"><span>Remise</span><span>-{eur(s.discountCents)}</span></p> : null}
        <div className="my-2 border-t border-dashed border-black" />
        <p className="flex justify-between text-[14px] font-bold"><span>TOTAL TVAC</span><span>{eur(s.totalCents)}</span></p>
        {t.byRate.map((r) => <p key={r.rate} className="flex justify-between"><span>dont TVA {r.rate} %</span><span>{eur(r.vat)}</span></p>)}
        <p className="mt-1 flex justify-between"><span>{PAY_METHODS[s.method as keyof typeof PAY_METHODS] ?? s.method}</span><span>{eur(s.cashGivenCents ?? s.totalCents)}</span></p>
        {s.cashGivenCents ? <p className="flex justify-between"><span>Rendu</span><span>{eur(s.cashGivenCents - s.totalCents)}</span></p> : null}
        <p className="mt-3 text-center">Merci et à bientôt !</p>
        <p className="text-center text-[10px]">Ce ticket n&apos;est pas une facture.</p>
      </div>
    </div>
  );
}
