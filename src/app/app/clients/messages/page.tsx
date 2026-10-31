import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessagesInbox } from "@/components/connect/messages-inbox";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { contactMessagesOf } from "@/server/contact-messages";

export const metadata: Metadata = { title: "Messages du site" };
export const dynamic = "force-dynamic";

/** Messages reçus par le formulaire de contact du site (widget, site Skydev ou site sur mesure). */
export default async function MessagesPage() {
  const ctx = await requireContext(undefined, { app: "clients" });
  if (!ctx.can("customers.view")) redirect("/app/acces-refuse");
  const rows = await contactMessagesOf(ctx.business.id);
  const unread = rows.filter((r) => !r.readAt).length;
  return (
    <>
      <PageHeader title="Messages du site" description={unread ? `${unread} message${unread > 1 ? "s" : ""} non lu${unread > 1 ? "s" : ""}.` : "Les messages envoyés depuis le formulaire de contact de votre site."} />
      <MessagesInbox
        rows={rows.map((r) => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, subject: r.subject, message: r.message, source: r.source, pageUrl: r.pageUrl, customerId: r.customerId, read: !!r.readAt, createdAt: r.createdAt.toISOString() }))}
        canManage={ctx.can("customers.manage")}
        timezone={ctx.business.timezone || "Europe/Brussels"}
      />
    </>
  );
}
