import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicBusinessPage, { generateMetadata as businessMetadata } from "@/app/(public)/[slug]/page";
import { businessSlugForDomain } from "@/server/site-builder";

export const dynamic = "force-dynamic";

/**
 * Domaine personnalisé d'un site « Mon site » : le proxy réécrit « / » de ce domaine vers cette page,
 * qui affiche l'établissement correspondant (l'adresse reste celle du domaine).
 */
type Params = Promise<{ host: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const slug = await businessSlugForDomain(decodeURIComponent((await params).host));
  return slug ? businessMetadata({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) }) : {};
}

export default async function DomainPage({ params }: { params: Params }) {
  const slug = await businessSlugForDomain(decodeURIComponent((await params).host));
  if (!slug) notFound();
  return PublicBusinessPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });
}
