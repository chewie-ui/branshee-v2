import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TableMenu } from "@/components/orders/table-menu";
import { menuOf, tableByToken } from "@/server/orders";
import { intlLocale } from "@/i18n";
import { publicTexts } from "@/i18n/public-pages";
import { resolvePublicLocale } from "@/i18n/server";

export const dynamic = "force-dynamic";
type Params = Promise<{ token: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const t = await tableByToken((await params).token);
  return { title: { absolute: t ? `Carte · ${t.business.name}` : "Carte" }, robots: { index: false, follow: false } };
}

/** Page ouverte en scannant le QR code d'une table : la carte, le panier et l'envoi de la commande. */
export default async function TablePage({ params, searchParams }: { params: Params; searchParams: Promise<{ lang?: string }> }) {
  const { token } = await params;
  const locale = await resolvePublicLocale((await searchParams).lang);
  const t = await tableByToken(token);
  if (!t) notFound();
  const { categories, items } = await menuOf(t.business.id, { onlyAvailable: true });
  return <TableMenu token={token} businessName={t.business.name} photoUrl={t.business.photoUrl} tableLabel={t.table.label} categories={categories} items={items} tx={publicTexts(locale).table} intl={intlLocale(locale)} />;
}
