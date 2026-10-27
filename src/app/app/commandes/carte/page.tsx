import type { Metadata } from "next";
import { MenuEditor } from "@/components/orders/menu-editor";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { menuOf } from "@/server/orders";

export const metadata: Metadata = { title: "Carte" };

export default async function MenuPage() {
  const ctx = await requireContext();
  const { categories, items } = await menuOf(ctx.business.id);
  return (
    <>
      <PageHeader title="Carte" description="Les plats et boissons que vos clients voient en scannant le QR code." />
      <MenuEditor categories={categories} items={items} canEdit={ctx.member.isOwner || ctx.can("settings.manage")} />
    </>
  );
}
