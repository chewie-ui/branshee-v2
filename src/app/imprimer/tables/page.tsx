import type { Metadata } from "next";
import QRCode from "qrcode";
import { PrintToolbar } from "@/components/invoicing/print-toolbar";
import { requireContext } from "@/server/context";
import { tableOrigin, tablesOf } from "@/server/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "QR codes des tables" }, robots: { index: false } };

/** Planche A4 des QR codes (6 par page), à découper et poser sur les tables. */
export default async function PrintTables() {
  const ctx = await requireContext();
  const origin = tableOrigin();
  const tables = (await tablesOf(ctx.business.id)).filter((t) => t.active);
  const cards = await Promise.all(tables.map(async (t) => ({ id: t.id, label: t.label, qr: await QRCode.toDataURL(`${origin}/t/${t.token}`, { margin: 1, width: 480, errorCorrectionLevel: "M" }) })));
  return (
    <div className="min-h-dvh bg-surface-muted py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 10mm; } @media print { html, body { background: #fff; } }`}</style>
      <PrintToolbar />
      <div className="mx-auto grid w-[794px] max-w-full grid-cols-2 gap-4 bg-white p-8 text-[#18181b] shadow-sm print:w-full print:p-0 print:shadow-none">
        {cards.length === 0 ? <p className="col-span-2 py-16 text-center text-[#52525b]">Aucune table à imprimer.</p> : null}
        {cards.map((c) => (
          <div key={c.id} className="flex break-inside-avoid flex-col items-center rounded-xl border-2 border-dashed border-[#d4d4d8] p-5 text-center">
            <p className="text-sm text-[#52525b]">{ctx.business.name}</p>
            <p className="text-xl font-semibold">{c.label}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.qr} alt="" className="my-3 size-44" />
            <p className="font-medium">Scannez pour voir la carte et commander</p>
            <p className="text-xs text-[#52525b]">Appareil photo du téléphone, sans application</p>
          </div>
        ))}
      </div>
    </div>
  );
}
