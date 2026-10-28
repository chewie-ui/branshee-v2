import type { Metadata } from "next";
import { OpenRegister, PosRegister } from "@/components/pos/pos-register";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { openSessionOf, productsOf, sessionTotals } from "@/server/stock";

export const metadata: Metadata = { title: "Caisse" };
export const dynamic = "force-dynamic";

export default async function PosPage() {
  const ctx = await requireContext();
  const session = await openSessionOf(ctx.business.id);
  if (!session) return (<><PageHeader title="Caisse" description="Encaissez au comptoir : espèces ou carte, avec le stock à jour." /><OpenRegister /></>);
  const [list, t] = await Promise.all([productsOf(ctx.business.id, { activeOnly: true }), sessionTotals(ctx.business.id, session.id)]);
  const since = new Intl.DateTimeFormat("fr-BE", { timeZone: ctx.business.timezone || "Europe/Brussels", hour: "2-digit", minute: "2-digit" }).format(session.openedAt);
  return (
    <>
      <h1 className="sr-only">Caisse</h1>
      <PosRegister products={list.map((p) => ({ ...p, costCents: null }))} expectedCash={session.openingCashCents + t.cash} sessionInfo={`Ouverte à ${since} · ${t.tickets} ticket${t.tickets > 1 ? "s" : ""}`} />
    </>
  );
}
