import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { InterventionSheet } from "@/components/interventions/intervention-sheet";
import { requireContext } from "@/server/context";
import { canWork, interventionOf, interventionRights } from "@/server/interventions";
import { teamOf } from "@/server/projects";

export const metadata: Metadata = { title: "Intervention" };

export default async function InterventionPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const r = await interventionOf(ctx.business.id, (await params).id);
  if (!r) notFound();
  const rights = interventionRights(ctx);
  const [team, clients] = await Promise.all([teamOf(ctx.business.id), rights.manage ? db.select({ id: customers.id, name: customers.fullName, company: customers.companyName }).from(customers).where(eq(customers.businessId, ctx.business.id)).orderBy(asc(customers.fullName)).limit(3000) : Promise.resolve([])]);
  const i = r.i;
  const local = i.scheduledAt ? new Intl.DateTimeFormat("sv-SE", { timeZone: ctx.business.timezone || "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(i.scheduledAt).replace(" ", "T") : "";
  return (
    <InterventionSheet
      data={{ id: i.id, number: i.number, title: i.title, description: i.description, clientName: i.clientName, clientPhone: i.clientPhone, clientEmail: i.clientEmail, address: i.address, customerId: i.customerId, status: i.status, scheduledAt: i.scheduledAt?.toISOString() ?? null, durationMinutes: i.durationMinutes, tech: r.tech, technicianId: i.technicianId, report: i.report ?? "", items: i.items, laborMinutes: i.laborMinutes, photos: i.photos.map((p) => ({ ref: p.ref, kind: p.kind, name: p.name })), signerName: i.signerName, signaturePath: i.signaturePath, signedAt: i.signedAt?.toISOString() ?? null, invoiceId: i.invoiceId, scheduledLocal: local }}
      canWork={canWork(ctx, i)}
      canManage={rights.manage}
      canInvoice={rights.manage && ctx.can("invoices.manage")}
      team={team}
      clients={clients.map((c) => ({ id: c.id, name: c.company ? `${c.company} (${c.name})` : c.name }))}
      tz={ctx.business.timezone || "Europe/Brussels"}
    />
  );
}
