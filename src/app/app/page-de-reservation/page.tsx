import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingPageSettings, formQuestions } from "@/db/schema";
import { CopyLink } from "@/components/app/copy-link";
import { FormQuestionsEditor, PageContentEditor } from "@/components/booking-page/editors";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Page de réservation" };

export default async function BookingPageSettings() {
  const ctx = await requireContext("customization.manage");
  const [[page], questions] = await Promise.all([
    db.select().from(bookingPageSettings).where(eq(bookingPageSettings.businessId, ctx.business.id)),
    db.select().from(formQuestions).where(eq(formQuestions.businessId, ctx.business.id)).orderBy(asc(formQuestions.position)),
  ]);
  const url = `${process.env.APP_URL ?? "https://branshee.com"}/${ctx.business.slug}`;
  const embed = `<iframe src="${url}" style="width:100%;min-height:760px;border:0" title="Prendre rendez-vous"></iframe>`;

  return (
    <>
      <PageHeader
        title="Page de réservation"
        description="Ce que vos clients voient quand ils réservent en ligne."
        action={<ButtonLink href={`/${ctx.business.slug}`} target="_blank" variant="secondary" icon={<ExternalLink className="size-4" aria-hidden="true" />}>Voir ma page</ButtonLink>}
      />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Partager" description="Ajoutez ce lien sur Google, Instagram, WhatsApp, votre site…" />
          <div className="space-y-4 p-5">
            <CopyLink url={url} />
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-accent hover:text-accent-hover">Intégrer le calendrier dans votre site web</summary>
              <p className="mt-2 text-muted">Copiez ce code dans votre site (bloc HTML) :</p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-muted p-3 text-xs">{embed}</pre>
            </details>
            <p className="text-sm text-muted">
              Le nom, la présentation et les coordonnées se modifient dans{" "}
              <Link href="/app/reglages/etablissement" className="font-medium text-accent hover:text-accent-hover">Réglages → Établissement</Link>.
            </p>
          </div>
        </Card>
        {ctx.can("forms.manage") ? <FormQuestionsEditor initial={questions.map((q) => ({ label: q.label, type: q.type, isRequired: q.isRequired, options: q.options }))} /> : null}
        <PageContentEditor initial={{ accentColor: page?.theme.accentColor ?? "#4f46e5", faq: page?.faq ?? [] }} />
      </div>
    </>
  );
}
