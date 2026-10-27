import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, services } from "@/db/schema";
import { DocumentEditor, type EditorDoc } from "@/components/invoicing/document-editor";
import { addDays, newLine, todayIso } from "@/lib/invoicing";
import { requireContext } from "@/server/context";
import { editorProps } from "@/server/invoicing-editor";

export const metadata: Metadata = { title: "Nouveau document" };

/** Nouvelle facture ou nouveau devis ; `?client=` pré-choisit le client, `?rdv=` reprend un rendez-vous. */
export default async function Page({ searchParams }: { searchParams: Promise<{ type?: string; client?: string; rdv?: string }> }) {
  const ctx = await requireContext("invoices.manage");
  const sp = await searchParams;
  const p = await editorProps(ctx);
  const quote = sp.type === "devis";
  const today = todayIso(ctx.business.timezone);
  let customerId = sp.client && p.customers.some((c) => c.id === sp.client) ? sp.client : null;
  let lines = [newLine()];
  let serviceDate = today;
  let appointmentId: string | null = null;
  // Facturer un rendez-vous : client, prestation, prix et date repris de l'agenda.
  if (!quote && sp.rdv && /^[0-9a-f-]{36}$/i.test(sp.rdv)) {
    const [a] = await db.select({ id: appointments.id, customerId: appointments.customerId, service: appointments.serviceName, price: services.priceCents, startsAt: appointments.startsAt }).from(appointments).leftJoin(services, eq(services.id, appointments.serviceId)).where(and(eq(appointments.businessId, ctx.business.id), eq(appointments.id, sp.rdv)));
    if (a) {
      appointmentId = a.id;
      customerId = a.customerId && p.customers.some((c) => c.id === a.customerId) ? a.customerId : customerId;
      serviceDate = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.business.timezone }).format(a.startsAt);
      lines = [{ ...newLine(), desc: a.service ?? "Prestation", unit: "séance", price: (a.price ?? 0) / 100 }];
    }
  }
  const initial: EditorDoc = {
    docType: quote ? "quote" : "invoice",
    status: "draft",
    number: null,
    customerId,
    issueDate: today,
    serviceDate: quote ? null : serviceDate,
    dueDate: quote ? null : addDays(today, p.seller.paymentDays),
    validUntil: quote ? addDays(today, 30) : null,
    notes: p.seller.defaultNotes,
    lines,
    appointmentId,
  };
  return <DocumentEditor initial={initial} {...p} />;
}
