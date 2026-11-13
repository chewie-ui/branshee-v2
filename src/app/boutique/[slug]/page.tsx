import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopFront } from "@/components/shop/shop-front";
import { publicShop } from "@/server/shop";
import { publicTexts } from "@/i18n/public-pages";
import { resolvePublicLocale } from "@/i18n/server";
import { intlLocale } from "@/i18n";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, members } from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";
import { decodeShopTheme, resolveShopTheme, shopFont, shopVars } from "@/lib/shop-theme";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const s = await publicShop((await params).slug);
  return { title: { absolute: s ? `Boutique · ${s.business.name}` : "Boutique" }, description: s?.settings.intro ?? undefined };
}

/** Boutique en ligne publique d'une entreprise. */
export default async function ShopFrontPage({ params, searchParams }: { params: Params; searchParams: Promise<{ lang?: string; theme?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const locale = await resolvePublicLocale(sp.lang);
  // Aperçu en direct de l'éditeur (?theme=) : réservé aux membres de l'entreprise, même boutique fermée.
  let preview = false;
  if (sp.theme) {
    const u = (await getSessionUser())?.user;
    const [b] = u ? await db.select({ id: members.id }).from(members).innerJoin(businesses, eq(businesses.id, members.businessId)).where(and(eq(businesses.slug, slug), eq(members.userId, u.id), eq(members.status, "active"))).limit(1) : [];
    preview = !!b;
  }
  const s = await publicShop(slug, { preview });
  if (!s) notFound();
  const theme = (preview ? decodeShopTheme(sp.theme) : null) ?? resolveShopTheme(s.settings.theme);
  const font = shopFont(theme);
  return (
    <>
    {font ? <link rel="stylesheet" href={font} /> : null}
    <ShopFront
      look={{ vars: shopVars(theme), layout: theme.layout, bannerUrl: theme.bannerUrl || null, title: theme.title || null }}
      slug={slug}
      business={{ name: s.business.name, photoUrl: s.business.photoUrl, city: s.business.city }}
      settings={{ intro: s.settings.intro, pickup: s.settings.pickup, pickupNote: s.settings.pickupNote, delivery: s.settings.delivery, deliveryCents: s.settings.deliveryCents, freeDeliveryFromCents: s.settings.freeDeliveryFromCents, deliveryNote: s.settings.deliveryNote, payOnline: s.canPayOnline, payOnPickup: s.settings.payOnPickup, payTransfer: s.settings.payTransfer }}
      items={s.items}
      seller={s.seller}
      tx={publicTexts(locale).shop}
      intl={intlLocale(locale)}
    />
    </>
  );
}
