import type { Metadata } from "next";
import QRCode from "qrcode";
import { TablesEditor } from "@/components/orders/tables-editor";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { tableOrigin, tablesOf } from "@/server/orders";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Tables");

export default async function TablesPage() {
  const t = await appT();
  const ctx = await requireContext();
  const origin = tableOrigin();
  const tables = await tablesOf(ctx.business.id);
  const rows = await Promise.all(tables.map(async (tp) => ({ id: tp.id, label: tp.label, url: `${origin}/tp/${tp.token}`, qr: await QRCode.toDataURL(`${origin}/tp/${tp.token}`, { margin: 1, width: 240 }) })));
  return (
    <>
      <PageHeader title={t("Tables")} description={t("Un QR code par table : vos clients le scannent pour voir la carte et commander.")} />
      <TablesEditor tables={rows} canEdit={ctx.member.isOwner || ctx.can("settings.manage")} />
    </>
  );
}
