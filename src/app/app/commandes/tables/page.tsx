import type { Metadata } from "next";
import QRCode from "qrcode";
import { TablesEditor } from "@/components/orders/tables-editor";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { tableOrigin, tablesOf } from "@/server/orders";

export const metadata: Metadata = { title: "Tables" };

export default async function TablesPage() {
  const ctx = await requireContext();
  const origin = tableOrigin();
  const tables = await tablesOf(ctx.business.id);
  const rows = await Promise.all(tables.map(async (t) => ({ id: t.id, label: t.label, url: `${origin}/t/${t.token}`, qr: await QRCode.toDataURL(`${origin}/t/${t.token}`, { margin: 1, width: 240 }) })));
  return (
    <>
      <PageHeader title="Tables" description="Un QR code par table : vos clients le scannent pour voir la carte et commander." />
      <TablesEditor tables={rows} canEdit={ctx.member.isOwner || ctx.can("settings.manage")} />
    </>
  );
}
