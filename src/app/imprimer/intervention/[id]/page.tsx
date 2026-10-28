import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintToolbar } from "@/components/invoicing/print-toolbar";
import { SignatureSvg } from "@/components/signature/signature-svg";
import { itemsTotal } from "@/lib/interventions";
import { requireContext } from "@/server/context";
import { interventionOf } from "@/server/interventions";
import { getSellerSettings } from "@/server/invoicing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Bon d'intervention" }, robots: { index: false } };
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);

/** Bon d'intervention A4 : client, travaux, fournitures, photos (nombre), signature. */
export default async function PrintIntervention({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const r = await interventionOf(ctx.business.id, (await params).id);
  if (!r) notFound();
  const i = r.i;
  const s = await getSellerSettings(ctx.business.id);
  const tz = ctx.business.timezone || "Europe/Brussels";
  const fmt = (d: Date | null) => (d ? new Intl.DateTimeFormat("fr-BE", { timeZone: tz, dateStyle: "long", timeStyle: "short" }).format(d) : "—");
  return (
    <div className="min-h-dvh bg-surface-muted py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 15mm; } @media print { html, body { background: #fff; } }`}</style>
      <PrintToolbar />
      <div className="mx-auto w-[794px] max-w-full bg-white p-10 text-[13px] text-[#18181b] shadow-sm print:w-full print:p-0 print:shadow-none">
        <div className="flex justify-between gap-6">
          <div><p className="text-lg font-semibold">{s.tradeName || ctx.business.name}</p><p className="text-[#52525b]">{[s.street, [s.zip, s.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p>{s.vatNumber ? <p className="text-[#52525b]">TVA {s.vatNumber}</p> : null}</div>
          <div className="text-right"><p className="text-xl font-semibold">Bon d&apos;intervention</p><p>n° {i.number}</p></div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-6">
          <div><p className="text-xs font-semibold text-[#52525b] uppercase">Client</p><p className="font-medium">{i.clientName}</p>{i.address ? <p>{i.address}</p> : null}{i.clientPhone ? <p>{i.clientPhone}</p> : null}</div>
          <div><p className="text-xs font-semibold text-[#52525b] uppercase">Intervention</p><p className="font-medium">{i.title}</p><p>Prévue : {fmt(i.scheduledAt)}</p><p>Début : {fmt(i.startedAt)} · Fin : {fmt(i.finishedAt)}</p><p>Technicien : {r.tech ?? "—"}</p></div>
        </div>
        {i.report ? <div className="mt-6"><p className="text-xs font-semibold text-[#52525b] uppercase">Travaux réalisés</p><p className="mt-1 whitespace-pre-line">{i.report}</p></div> : null}
        {i.items.length ? (
          <table className="mt-6 w-full border-collapse">
            <thead><tr className="border-b border-[#d4d4d8] text-left text-xs text-[#52525b] uppercase"><th className="py-1.5">Désignation</th><th className="py-1.5 text-right">Qté</th><th className="py-1.5 text-right">Prix HTVA</th><th className="py-1.5 text-right">Total HTVA</th></tr></thead>
            <tbody>{i.items.map((it, k) => <tr key={k} className="border-b border-[#f4f4f5]"><td className="py-1.5">{it.name}</td><td className="py-1.5 text-right">{String(it.qty).replace(".", ",")}</td><td className="py-1.5 text-right">{eur(it.unitCents)}</td><td className="py-1.5 text-right">{eur(Math.round(it.qty * it.unitCents))}</td></tr>)}</tbody>
            <tfoot><tr><td colSpan={3} className="py-2 text-right font-semibold">Total HTVA</td><td className="py-2 text-right font-semibold">{eur(itemsTotal(i.items))}</td></tr></tfoot>
          </table>
        ) : null}
        {i.photos.length ? <p className="mt-4 text-[#52525b]">{i.photos.length} photo{i.photos.length > 1 ? "s" : ""} jointe{i.photos.length > 1 ? "s" : ""} au dossier.</p> : null}
        <div className="mt-10 grid grid-cols-2 gap-6">
          <div><p className="text-xs font-semibold text-[#52525b] uppercase">Signature du client</p>{i.signaturePath ? <><SignatureSvg path={i.signaturePath} className="mt-1 h-24 w-full text-black" /><p>{i.signerName} · {fmt(i.signedAt)}</p></> : <div className="mt-1 h-24 rounded border border-dashed border-[#a1a1aa]" />}</div>
          <div className="text-[#52525b]"><p className="text-xs font-semibold uppercase">Bon pour accord des travaux réalisés</p><p className="mt-1">Ce bon n&apos;est pas une facture.</p></div>
        </div>
      </div>
    </div>
  );
}
