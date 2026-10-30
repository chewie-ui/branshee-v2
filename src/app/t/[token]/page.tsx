import type { Metadata } from "next";
import { QrCode } from "lucide-react";
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
  // QR remplacé ou table supprimée : un message clair pour le client attablé, pas une page d'erreur.
  if (!t) {
    const msg = { fr: ["Ce QR code n'est plus valable", "Demandez au personnel le nouveau QR code de votre table."], nl: ["Deze QR-code is niet meer geldig", "Vraag het personeel naar de nieuwe QR-code van uw tafel."], en: ["This QR code is no longer valid", "Please ask the staff for your table's new QR code."] }[locale as "fr" | "nl" | "en"] ?? ["Ce QR code n'est plus valable", "Demandez au personnel le nouveau QR code de votre table."];
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
        <QrCode className="size-10 text-muted" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold">{msg[0]}</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">{msg[1]}</p>
      </main>
    );
  }
  const { categories, items } = await menuOf(t.business.id, { onlyAvailable: true });
  return <TableMenu token={token} businessName={t.business.name} photoUrl={t.business.photoUrl} tableLabel={t.table.label} categories={categories} items={items} tx={publicTexts(locale).table} intl={intlLocale(locale)} />;
}
