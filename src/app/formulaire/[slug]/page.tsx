import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { bookingPageSettings, businesses } from "@/db/schema";
import { ContactWidget } from "@/components/connect/contact-widget";
import { EmbedResize } from "@/components/public/frame-bridge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contact", robots: { index: false, follow: false } };

/** Formulaire de contact à intégrer sur n'importe quel site (iframe) : le message arrive dans Skydev. */
export default async function ContactFormPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ couleur?: string; titre?: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound();
  const sp = await searchParams;
  const [b] = await db.select({ name: businesses.name, theme: bookingPageSettings.theme }).from(businesses).leftJoin(bookingPageSettings, eq(bookingPageSettings.businessId, businesses.id)).where(and(eq(businesses.slug, slug), isNull(businesses.deletedAt)));
  if (!b) notFound();
  const fromTheme = b.theme?.accentColor;
  const color = /^#[0-9a-f]{6}$/i.test(sp.couleur ?? "") ? sp.couleur! : /^#[0-9a-f]{6}$/i.test(fromTheme ?? "") ? fromTheme! : "#4f46e5";
  const title = (sp.titre ?? "").slice(0, 80);
  return (
    <main className="min-h-0 bg-white p-4 sm:p-6" data-embed-root>
      {title ? <h1 className="mb-4 text-xl font-semibold text-zinc-900">{title}</h1> : null}
      <ContactWidget slug={slug} businessName={b.name} color={color} />
      <EmbedResize />
    </main>
  );
}
