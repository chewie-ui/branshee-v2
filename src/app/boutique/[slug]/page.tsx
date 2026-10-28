import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopFront } from "@/components/shop/shop-front";
import { publicShop } from "@/server/shop";
import { publicTexts } from "@/i18n/public-pages";
import { resolvePublicLocale } from "@/i18n/server";
import { intlLocale } from "@/i18n";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const s = await publicShop((await params).slug);
  return { title: { absolute: s ? `Boutique · ${s.business.name}` : "Boutique" }, description: s?.settings.intro ?? undefined };
}

/** Boutique en ligne publique d'une entreprise. */
export default async function ShopFrontPage({ params, searchParams }: { params: Params; searchParams: Promise<{ lang?: string }> }) {
  const { slug } = await params;
  const locale = await resolvePublicLocale((await searchParams).lang);
  const s = await publicShop(slug);
  if (!s) notFound();
  return (
    <ShopFront
      slug={slug}
      business={{ name: s.business.name, photoUrl: s.business.photoUrl, city: s.business.city }}
      settings={{ intro: s.settings.intro, pickup: s.settings.pickup, pickupNote: s.settings.pickupNote, delivery: s.settings.delivery, deliveryCents: s.settings.deliveryCents, freeDeliveryFromCents: s.settings.freeDeliveryFromCents, deliveryNote: s.settings.deliveryNote, payOnline: s.canPayOnline, payOnPickup: s.settings.payOnPickup, payTransfer: s.settings.payTransfer }}
      items={s.items}
      seller={s.seller}
      tx={publicTexts(locale).shop}
      intl={intlLocale(locale)}
    />
  );
}
