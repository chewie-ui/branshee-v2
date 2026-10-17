import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingPageSettings, businesses, formQuestions } from "@/db/schema";
import { GalleryEditor, LocationEditor, ProfileEditor, SectionsEditor, SocialEditor } from "@/components/booking-page/content-editors";
import { FaqEditor, FormQuestionsEditor } from "@/components/booking-page/editors";
import { PageTabs } from "@/components/booking-page/page-tabs";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { sanitizeRichText } from "@/server/rich-text";

export const metadata: Metadata = { title: "Page de réservation" };

export default async function BookingPageContent() {
  const ctx = await requireContext("customization.manage");
  const [[page], [b], questions] = await Promise.all([
    db.select().from(bookingPageSettings).where(eq(bookingPageSettings.businessId, ctx.business.id)),
    db.select().from(businesses).where(eq(businesses.id, ctx.business.id)),
    db.select().from(formQuestions).where(eq(formQuestions.businessId, ctx.business.id)).orderBy(asc(formQuestions.position)),
  ]);
  const show = page?.showContact ?? { email: true, phone: true, instagram: true, facebook: true, whatsapp: true, website: true };
  // L'ancienne carte était stockée telle quelle (code iframe) : on la représente par son URL.
  const embed = b!.mapEmbedUrl ? `<iframe src="${b!.mapEmbedUrl}"></iframe>` : "";

  return (
    <>
      <PageHeader
        title="Page de réservation"
        description="Ce que vos clients voient quand ils réservent en ligne."
        action={<ButtonLink href={`/${ctx.business.slug}`} target="_blank" variant="secondary" icon={<ExternalLink className="size-4" aria-hidden="true" />}>Voir ma page</ButtonLink>}
      />
      <PageTabs />
      <div className="mx-auto max-w-3xl space-y-6">
        <ProfileEditor name={b!.name} photoUrl={b!.photoUrl} aboutHtml={sanitizeRichText(b!.aboutHtml ?? (b!.description ? b!.description.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!).replace(/\n/g, "<br>") : ""))} />
        <SectionsEditor visible={page?.sections ?? ["about", "location", "hours"]} />
        <LocationEditor
          initial={{ mode: b!.locationMode, address: b!.address ?? "", postalCode: b!.postalCode ?? "", city: b!.city ?? "", country: b!.country ?? "", mapsUrl: b!.mapsUrl ?? "", mapEmbed: embed, languages: b!.languages }}
        />
        <GalleryEditor images={page?.gallery ?? []} layout={page?.galleryLayout ?? "grid"} />
        <SocialEditor
          email={b!.email}
          phone={b!.phone}
          initial={{ website: b!.website ?? "", instagram: b!.social.instagram ?? "", facebook: b!.social.facebook ?? "", whatsapp: b!.social.whatsapp ?? "", tiktok: b!.social.tiktok ?? "", linkedin: b!.social.linkedin ?? "", youtube: b!.social.youtube ?? "", show }}
        />
        <FaqEditor initial={page?.faq ?? []} />
        {ctx.can("forms.manage") ? <FormQuestionsEditor initial={questions.map((q) => ({ label: q.label, type: q.type, isRequired: q.isRequired, options: q.options }))} /> : null}
      </div>
    </>
  );
}
