import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Gift } from "lucide-react";
import { db } from "@/db";
import { giftCards } from "@/db/schema";
import { PrintToolbar } from "@/components/invoicing/print-toolbar";
import { requireContext } from "@/server/context";
import { getSellerSettings } from "@/server/invoicing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Carte cadeau" }, robots: { index: false } };
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);

/** Carte cadeau imprimable (format carte postale A6). */
export default async function PrintGiftCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await requireContext();
  const [g] = await db.select().from(giftCards).where(and(eq(giftCards.id, id), eq(giftCards.businessId, ctx.business.id)));
  if (!g) notFound();
  const s = await getSellerSettings(ctx.business.id);
  return (
    <div className="min-h-dvh bg-surface-muted py-6 print:bg-white print:py-0">
      <style>{`@page { size: A6 landscape; margin: 0; } @media print { html, body { background: #fff; } }`}</style>
      <PrintToolbar />
      <div className="mx-auto flex aspect-[148/105] w-[560px] max-w-full flex-col justify-between rounded-2xl p-8 text-white shadow-lg print:w-full print:rounded-none print:shadow-none" style={{ background: /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : "#4f46e5" }}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-sm opacity-90">{s.tradeName || ctx.business.name}</p><p className="text-3xl font-semibold">Carte cadeau</p></div>
          <Gift className="size-10 opacity-90" aria-hidden="true" />
        </div>
        <div>
          {g.recipientName ? <p className="text-lg">Pour {g.recipientName}{g.buyerName ? `, de la part de ${g.buyerName}` : ""}</p> : null}
          {g.message ? <p className="mt-1 text-sm italic opacity-90">« {g.message} »</p> : null}
        </div>
        <div className="flex items-end justify-between gap-4">
          <div><p className="text-4xl font-bold">{eur(g.initialCents)}</p><p className="text-sm opacity-90">Valable jusqu&apos;au {g.expiresOn.split("-").reverse().join("/")}</p></div>
          <p className="rounded-lg bg-white/20 px-3 py-2 font-mono text-xl font-semibold tracking-wider">{g.code}</p>
        </div>
      </div>
    </div>
  );
}
