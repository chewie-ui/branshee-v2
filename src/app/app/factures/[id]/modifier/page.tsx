import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DocumentEditor } from "@/components/invoicing/document-editor";
import { requireContext } from "@/server/context";
import { getDocument, relatedDocuments } from "@/server/invoicing";
import { editorProps } from "@/server/invoicing-editor";

export const metadata: Metadata = { title: "Modifier" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("invoices.manage");
  const d = await getDocument(ctx.business.id, (await params).id);
  if (!d) notFound();
  // Une facture émise ne se modifie plus ; un devis facturé non plus.
  if ((d.docType !== "quote" && d.status !== "draft") || (d.docType === "quote" && d.status === "invoiced")) redirect(`/app/factures/${d.id}`);
  const [p, rel] = await Promise.all([editorProps(ctx), relatedDocuments(ctx.business.id, d)]);
  return (
    <DocumentEditor
      {...p}
      initial={{ id: d.id, docType: d.docType, status: d.status, number: d.number, customerId: d.customerId, issueDate: d.issueDate, serviceDate: d.serviceDate, dueDate: d.dueDate, validUntil: d.validUntil, notes: d.notes, lines: d.lines, relatedId: d.relatedId, related: rel.linked, appointmentId: d.appointmentId }}
    />
  );
}
