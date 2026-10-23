import type { Metadata } from "next";
import { after } from "next/server";
import { MiniSite } from "@/components/site/mini-site";
import type { SiteSection } from "@/lib/site-templates";
import { countSiteVisit, publishedSiteFor, siteContent } from "@/server/site-builder";
import { FeatureStatusPage } from "@/components/feature-status";
import { featureStatus } from "@/server/features";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Clock, Facebook, Globe, Instagram, Languages, Linkedin, Mail, MapPin, MessageCircle, Phone, Star, Video, Youtube } from "lucide-react";
import { format } from "date-fns";
import { BookingFlow, type BookingResume } from "@/components/booking/booking-flow";
import { EmbedResize, ThemePreview } from "@/components/public/frame-bridge";
import { CopyButton } from "@/components/public/copy-button";
import { Gallery } from "@/components/public/gallery";
import { ReadMore } from "@/components/public/read-more";
import { ReportReviewButton, ReviewForm } from "@/components/public/reviews";
import Link from "next/link";
import { getSessionUser } from "@/server/auth/session";
import { reviewEligibility } from "@/server/client-account";
import { Avatar } from "@/components/ui/avatar";
import { LANGUAGE_NAMES } from "@/lib/languages";
import { fontStylesheet, themeVars } from "@/lib/booking-theme";
import { cn } from "@/lib/cn";
import { zoned } from "@/lib/time";
import { Brand } from "@/components/brand";
import { getPublicBusiness, type PublicBusiness } from "@/server/public";
import { richTextToPlain } from "@/server/rich-text";
import { businessJsonLd, localDescription, localTitle } from "@/lib/local-seo";
import { createT, getMessages, intlLocale, type T } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { I18nProvider } from "@/i18n/client";
import { resolvePublicLocale } from "@/i18n/server";
import { LanguageSwitcher } from "@/components/public/language-switcher";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type Search = Promise<{ sections?: string; apercu?: string; reserver?: string; lang?: string; s?: string; m?: string; d?: string; h?: string; v?: string; q?: string | string[] }>;

const UUID = /^[0-9a-f-]{36}$/i;
/** Réservation reprise après connexion / inscription : prestation, praticien, créneau et réponses déjà choisis. */
function resumeFrom(sp: Awaited<Search>): BookingResume | null {
  if (!sp.s || !UUID.test(sp.s)) return null;
  const q = (Array.isArray(sp.q) ? sp.q : sp.q ? [sp.q] : []).flatMap((x) => {
    const [questionId, optionId] = x.split(".");
    return questionId && optionId && /^[\w-]{1,64}$/.test(questionId) && /^[\w-]{1,64}$/.test(optionId) ? [{ questionId, optionId }] : [];
  });
  return {
    serviceId: sp.s,
    memberId: sp.m && UUID.test(sp.m) ? sp.m : null,
    day: sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : null,
    time: sp.h && /^\d{2}:\d{2}$/.test(sp.h) ? sp.h : null,
    visit: sp.v === "new" || sp.v === "existing" ? sp.v : null,
    intake: q.slice(0, 20),
  };
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const data = await getPublicBusiness((await params).slug);
  if (!data) return { title: "Établissement introuvable" };
  const { business: b } = data;
  const sp = await searchParams;
  const site = typeof sp.sections !== "string" && !sp.reserver ? await publishedSiteFor(b.id) : null;
  if (site) return { title: { absolute: site.seo.title || b.name }, description: site.seo.description || b.description || undefined, openGraph: b.photoUrl ? { images: [b.photoUrl] } : undefined, alternates: { canonical: `/${b.slug}` } };
  const about = b.description ?? (data.aboutHtml ? richTextToPlain(data.aboutHtml).slice(0, 160) : null);
  // Référencement local : « Nom — Métier à Ville | Prendre rendez-vous », une seule adresse canonique (sans ?sections=…).
  const title = `${localTitle(b.name, b.businessType, b.city)} | Prendre rendez-vous`;
  const description = about && about.length > 60 ? about : localDescription(b.name, b.businessType, b.city);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/${b.slug}` },
    openGraph: { title, description, type: "website", url: `/${b.slug}`, images: b.photoUrl ? [b.photoUrl] : undefined },
  };
}

/** Semaine affichée du lundi au dimanche (0 = dimanche, comme `weekday` en base). */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

const CARD = "rounded-xl border border-border bg-surface shadow-[var(--card-shadow)]";

type ReviewCtx = { state: "hidden" } | { state: "anon" | "unverified" | "can" | "own" | "done"; slug: string };

/** « Ouvert aujourd'hui » à partir des horaires communs et d'une éventuelle fermeture exceptionnelle. */
function todayStatus(data: PublicBusiness, t: T): { open: boolean; label: string } | null {
  if (!data.hours.length) return null;
  const wd = Number(format(zoned(new Date(), data.business.timezone), "i")) % 7;
  const ex = data.todayException;
  const ranges = ex ? (ex.isClosed ? [] : ex.hours) : data.hours.filter((h) => h.weekday === wd);
  if (!ranges.length) return { open: false, label: t("page.closedToday") };
  return { open: true, label: t("page.openToday", { hours: ranges.map((r) => `${r.start}–${r.end}`).join(", ") }) };
}

/** Établissement en pause : page dédiée, avec les coordonnées pour joindre le pro. */
function PausedPage({ data, t }: { data: PublicBusiness; t: T }) {
  const b = data.business;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10 text-center">
      <Avatar name={b.name} src={b.photoUrl} size="lg" className="size-16 text-lg" />
      <h1 className="mt-4 text-2xl font-semibold">{b.name}</h1>
      <p className="mt-2 max-w-md text-muted">{t("page.pausedText")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
        {b.phone ? <a href={`tel:${b.phone.replace(/\s/g, "")}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 font-medium hover:bg-surface-muted"><Phone className="size-4" aria-hidden="true" />{b.phone}</a> : null}
        {b.email ? <a href={`mailto:${b.email}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 font-medium hover:bg-surface-muted"><Mail className="size-4" aria-hidden="true" />{b.email}</a> : null}
      </div>
      <footer className="mt-12 opacity-70"><Brand /></footer>
    </div>
  );
}

/** Lien social : accepte une URL complète ou un identifiant (« @moncabinet », un numéro WhatsApp). */
function socialHref(kind: string, v: string) {
  if (/^https?:\/\//i.test(v)) return v;
  const h = v.replace(/^@/, "");
  if (kind === "whatsapp") return `https://wa.me/${v.replace(/[^\d]/g, "")}`;
  const base: Record<string, string> = { instagram: "https://instagram.com/", facebook: "https://facebook.com/", tiktok: "https://tiktok.com/@", linkedin: "https://linkedin.com/in/", youtube: "https://youtube.com/@" };
  return (base[kind] ?? "https://") + encodeURIComponent(h);
}

export default async function PublicBusinessPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const gate = await featureStatus("booking_page");
  if (gate.status !== "active") return <FeatureStatusPage status={gate.status} message={gate.message} />;
  const data = await getPublicBusiness((await params).slug);
  if (!data) notFound();
  const sp = await searchParams;
  const { business: b, theme } = data;
  const today = format(zoned(new Date(), b.timezone), "yyyy-MM-dd");
  const locale = await resolvePublicLocale(sp.lang);
  const t = createT(getMessages(locale));
  if (data.closed) return <PausedPage data={data} t={t} />;
  // Forfait Pro+ avec un site publié : le site remplace la page à cette adresse (la réservation y est intégrée).
  if (typeof sp.sections !== "string" && !sp.apercu && !sp.reserver) {
    const site = await publishedSiteFor(b.id);
    if (site) {
      after(() => countSiteVisit(site.id));
      return <MiniSite site={{ sections: site.sections as SiteSection[], theme: site.theme, logoUrl: site.logoUrl, social: site.social }} business={{ id: b.id, name: b.name, slug: b.slug, noBranding: data.features.noBranding }} content={await siteContent(b.id)} />;
    }
  }
  const session = await getSessionUser();
  const review: ReviewCtx = !data.sections.includes("reviews")
    ? { state: "hidden" }
    : !session
      ? { state: "anon", slug: b.slug }
      : !session.user.emailVerifiedAt
        ? { state: "unverified", slug: b.slug }
        : await reviewEligibility(session.user.id, b.id).then((r) => (r.ok ? { state: "can", slug: b.slug } : { state: r.reason, slug: b.slug }));

  // Calendrier intégré sur le site du pro : `?sections=booking,profile,about,hours,reviews` (format de l'ancien Branshee).
  const embedded = typeof sp.sections === "string";
  const embedSecs = new Set((sp.sections ?? "").split(",").map((s) => s.trim()));
  const showProfile = !embedded || embedSecs.has("profile");
  const asideSections = embedded ? data.sections.filter((s) => embedSecs.has(s)) : data.sections;
  const fontHref = embedded && data.embed.fontUrl && data.embed.fontFamily ? data.embed.fontUrl : fontStylesheet(theme);
  const vars = themeVars(theme);
  if (embedded && data.embed.fontUrl && data.embed.fontFamily) vars["--font-sans"] = `"${data.embed.fontFamily}", ui-sans-serif, system-ui, sans-serif`;

  const aside = asideSections.filter((s) => hasContent(s, data)).map((s) => <SectionBlock key={s} kind={s} data={data} review={review} t={t} locale={locale} />);

  return (
    <I18nProvider locale={locale}>
    <div
      lang={locale}
      id="bp-root"
      data-layout={theme.layout}
      className="group min-h-dvh bg-cover bg-fixed bg-center text-text"
      style={{ ...(vars as React.CSSProperties), background: undefined, backgroundColor: "var(--background)", backgroundImage: theme.pageBgImage ? `url("${theme.pageBgImage}")` : undefined, fontFamily: "var(--font-sans)" }}
    >
      {fontHref ? <link rel="stylesheet" href={fontHref} /> : null}
      {!embedded ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: businessJsonLd({
              url: `${(process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "")}/${b.slug}`,
              name: b.name,
              businessType: b.businessType,
              description: b.description,
              photoUrl: b.photoUrl,
              phone: b.phone,
              email: b.email,
              address: b.address,
              postalCode: b.postalCode,
              city: b.city,
              country: b.country,
              hours: data.hours,
              reviews: { count: data.reviews.count, average: data.reviews.average },
              services: data.services.map((x) => ({ name: x.name, priceCents: x.priceCents })),
            }),
          }}
        />
      ) : null}

      {showProfile ? <ProfileHeader data={data} t={t} /> : null}

      <main className={cn("mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-6 sm:px-6", aside.length ? "lg:grid-cols-[1fr_320px]" : "max-w-3xl", embedded ? "lg:py-6" : "lg:py-10")}>
        <section className={cn(CARD, "min-w-0 p-5 sm:p-6")} aria-label={t("page.bookingLabel")}>
          {embedded && data.embed.title ? <h2 className="mb-4 text-xl font-semibold">{data.embed.title}</h2> : null}
          <BookingFlow data={data} today={today} resume={resumeFrom(sp)} viewer={session ? { firstName: session.user.fullName.split(" ")[0] ?? "", lastName: session.user.fullName.split(" ").slice(1).join(" "), email: session.user.email, phone: session.user.phone ?? "" } : null} />
        </section>

        {aside.length ? <aside className="space-y-4 lg:group-data-[layout=split]:order-first">{aside}</aside> : null}
      </main>

      {!embedded && !data.features.noBranding ? (
        <footer className="pb-8 text-center text-xs text-muted">
          {t("common.poweredBy")} <span className="font-medium text-text">Branshee</span>
        </footer>
      ) : null}
      <EmbedResize />
      {sp.apercu === "1" ? <ThemePreview /> : null}
    </div>
    </I18nProvider>
  );
}

function ProfileHeader({ data, t }: { data: PublicBusiness; t: T }) {
  const { business: b, showContact: show } = data;
  const links: { key: string; href: string; label: string; icon: ReactNode }[] = [];
  if (b.phone && show.phone) links.push({ key: "phone", href: `tel:${b.phone.replace(/\s/g, "")}`, label: b.phone, icon: <Phone className="size-4" aria-hidden="true" /> });
  if (b.email && show.email) links.push({ key: "email", href: `mailto:${b.email}`, label: b.email, icon: <Mail className="size-4" aria-hidden="true" /> });
  if (b.website && show.website && data.features.social) links.push({ key: "website", href: b.website, label: b.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), icon: <Globe className="size-4" aria-hidden="true" /> });
  const socials: { key: string; label: string; icon: ReactNode; on: boolean }[] = [
    { key: "instagram", label: "Instagram", icon: <Instagram className="size-4" aria-hidden="true" />, on: show.instagram },
    { key: "facebook", label: "Facebook", icon: <Facebook className="size-4" aria-hidden="true" />, on: show.facebook },
    { key: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="size-4" aria-hidden="true" />, on: show.whatsapp },
    { key: "tiktok", label: "TikTok", icon: <Video className="size-4" aria-hidden="true" />, on: true },
    { key: "linkedin", label: "LinkedIn", icon: <Linkedin className="size-4" aria-hidden="true" />, on: true },
    { key: "youtube", label: "YouTube", icon: <Youtube className="size-4" aria-hidden="true" />, on: true },
  ];
  const social = (data.features.social ? b.social : {}) as Record<string, string | undefined>;

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="flex items-center gap-4">
          <Avatar name={b.name} src={b.photoUrl} size="lg" className="size-16 text-lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <h1 className="min-w-0 text-xl font-semibold tracking-tight break-words sm:text-2xl">{b.name}</h1>
              <LanguageSwitcher className="shrink-0" />
            </div>
            <p className="text-sm text-muted">{[b.businessType, b.locationMode === "online" ? t("common.online") : b.city].filter(Boolean).join(" · ")}</p>
            {(() => {
              const st = todayStatus(data, t);
              return st ? <p className={cn("mt-0.5 text-sm font-medium", st.open ? "text-success" : "text-muted")}>{st.label}</p> : null;
            })()}
            {data.reviews.count > 0 && data.reviews.average != null ? (
              <p className="mt-0.5 flex items-center gap-1 text-sm">
                <Star className="size-4 fill-current text-warning" aria-hidden="true" />
                <span className="font-medium">{data.reviews.average.toFixed(1).replace(".", ",")}</span>
                <span className="text-muted">{t("page.reviewsCount", { n: data.reviews.count })}</span>
              </p>
            ) : null}
          </div>
        </div>
        {links.length || socials.some((s) => s.on && social[s.key]) ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {links.map((l) => (
              <span key={l.key} className="inline-flex min-w-0 items-center gap-0.5">
                <a href={l.href} target={l.key === "website" ? "_blank" : undefined} rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1.5 text-muted hover:text-accent">
                  {l.icon}
                  <span className="truncate">{l.label}</span>
                </a>
                {l.key !== "website" ? <CopyButton value={l.label} label={l.key === "phone" ? t("common.thePhone") : t("common.theEmail")} /> : null}
              </span>
            ))}
            {socials
              .filter((s) => s.on && social[s.key])
              .map((s) => (
                <a key={s.key} href={socialHref(s.key, social[s.key]!)} target="_blank" rel="noopener noreferrer" className="flex size-8 items-center justify-center rounded-full border border-border text-muted hover:border-accent hover:text-accent" aria-label={s.label}>
                  {s.icon}
                </a>
              ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}

function hasContent(kind: string, data: PublicBusiness) {
  const b = data.business;
  switch (kind) {
    case "about":
      return !!(data.aboutHtml || b.description);
    case "location":
      return b.locationMode === "online" || !!(b.address || b.city || b.mapEmbedUrl);
    case "hours":
      return data.hours.length > 0;
    case "gallery":
      return data.gallery.length > 0;
    case "reviews":
      return true;
    case "team":
      return data.team.length > 1;
    case "faq":
      return data.faq.length > 0;
    default:
      return false;
  }
}

function SectionBlock({ kind, data, review, t, locale }: { kind: string; data: PublicBusiness; review: ReviewCtx; t: T; locale: Locale }) {
  const b = data.business;
  if (!hasContent(kind, data)) return null;
  const address = [b.address, [b.postalCode, b.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const names = locale === "fr" ? null : new Intl.DisplayNames([intlLocale(locale)], { type: "language" });
  const langs = b.languages.map((c) => {
    const n = names?.of(c) ?? LANGUAGE_NAMES[c] ?? c;
    return n.charAt(0).toUpperCase() + n.slice(1);
  });

  switch (kind) {
    case "about":
      return (
        <div className={cn(CARD, "p-5")}>
          <h2 className="mb-2 font-semibold">{t("page.about")}</h2>
          <ReadMore long={(data.aboutHtml ? richTextToPlain(data.aboutHtml) : (b.description ?? "")).length > 420}>
            {data.aboutHtml ? (
              // HTML nettoyé côté serveur (liste blanche de balises de mise en forme).
              <div className="about-html text-sm text-muted" dangerouslySetInnerHTML={{ __html: data.aboutHtml }} />
            ) : (
              <p className="text-sm whitespace-pre-line text-muted">{b.description}</p>
            )}
          </ReadMore>
        </div>
      );
    case "location":
      return (
        <div className={cn(CARD, "space-y-3 p-5 text-sm")}>
          <h2 className="font-semibold">{b.locationMode === "online" ? t("page.onlineConsultation") : t("page.address")}</h2>
          {b.locationMode === "online" ? (
            <p className="flex gap-3 text-muted">
              <Video className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t("page.remote")}{b.country ? ` · ${b.country}` : ""}
            </p>
          ) : address ? (
            <p className="flex gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
              <a href={b.mapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.name} ${address}`)}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover">
                {address}
                {b.country ? `, ${b.country}` : ""}
              </a>
            </p>
          ) : null}
          {langs.length ? (
            <p className="flex gap-3 text-muted">
              <Languages className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {langs.join(", ")}
            </p>
          ) : null}
          {b.locationMode === "embed" && b.mapEmbedUrl ? (
            <iframe title={t("page.map", { name: b.name })} src={b.mapEmbedUrl} className="h-52 w-full rounded-lg border border-border" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          ) : b.locationMode === "on_site" && address ? (
            <iframe title={t("page.map", { name: b.name })} src={`https://www.google.com/maps?q=${encodeURIComponent([address, b.country].filter(Boolean).join(", "))}&output=embed`} className="h-52 w-full rounded-lg border border-border" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          ) : null}
        </div>
      );
    case "hours":
      return (
        <div className={cn(CARD, "p-5 text-sm")}>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Clock className="size-4 text-muted" aria-hidden="true" />
            {t("page.hours")}
          </h2>
          <dl className="space-y-1.5">
            {WEEK.map((wd) => {
              const ranges = data.hours.filter((h) => h.weekday === wd);
              return (
                <div key={wd} className="flex justify-between gap-4">
                  <dt className="text-muted">{getMessages(locale).page.days[wd]}</dt>
                  <dd className="text-right tabular-nums">{ranges.length ? ranges.map((r) => `${r.start}–${r.end}`).join(", ") : t("common.closed")}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      );
    case "gallery":
      return (
        <div className={cn(CARD, "p-5")}>
          <h2 className="mb-3 font-semibold">{t("page.gallery")}</h2>
          <Gallery images={data.gallery} layout={data.galleryLayout} name={b.name} />
        </div>
      );
    case "reviews":
      return (
        <div id="avis" className={cn(CARD, "scroll-mt-6 p-5")}>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            {t("page.reviews")}
            {data.reviews.average != null ? (
              <span className="flex items-center gap-1 text-sm font-normal text-muted">
                <Star className="size-4 fill-current text-warning" aria-hidden="true" />
                {data.reviews.average.toFixed(1).replace(".", ",")} · {data.reviews.count}
              </span>
            ) : null}
          </h2>
          {data.reviews.items.length ? (
            <ul className="space-y-3">
              {data.reviews.items.map((r) => (
                <li key={r.id} className="text-sm">
                  <p className="flex items-center gap-2">
                    <span className="font-medium">{r.author}</span>
                    <span className="flex text-warning" aria-label={t("reviews.outOf5", { n: r.rating })}>
                      {Array.from({ length: 5 }, (_, i) => <Star key={i} className={cn("size-3.5", i < r.rating ? "fill-current" : "opacity-30")} aria-hidden="true" />)}
                    </span>
                  </p>
                  {r.comment ? <p className="mt-0.5 text-muted">{r.comment}</p> : null}
                  <ReportReviewButton reviewId={r.id} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t("page.noReviews")}</p>
          )}
          <div className="mt-4">
            {review.state === "can" ? <ReviewForm slug={review.slug} /> : null}
            {review.state === "anon" ? (
              <p className="text-sm text-muted">
                <Link href={`/connexion?suite=${encodeURIComponent(`/${review.slug}#avis`)}`} className="font-medium text-accent hover:text-accent-hover">{t("page.login")}</Link>{t("page.loginToReview", { link: "" })}
              </p>
            ) : null}
            {review.state === "unverified" ? (
              <p className="text-sm text-muted">
                <Link href={`/verifier-email?suite=${encodeURIComponent(`/${review.slug}#avis`)}`} className="font-medium text-accent hover:text-accent-hover">{t("page.confirmEmail")}</Link>{t("page.confirmEmailToReview", { link: "" })}
              </p>
            ) : null}
            {review.state === "done" ? <p className="text-sm text-muted">{t("page.alreadyReviewed")}</p> : null}
          </div>
        </div>
      );
    case "team":
      return (
        <div className={cn(CARD, "p-5")}>
          <h2 className="mb-3 font-semibold">{t("page.team")}</h2>
          <ul className="space-y-3">
            {data.team.map((m) => (
              <li key={m.id} className="flex items-start gap-3">
                <Avatar name={m.name} src={m.photoUrl} />
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{m.name}</p>
                  {m.role ? <p className="truncate text-muted">{m.role}</p> : null}
                  {m.bio ? <p className="mt-1 text-muted">{m.bio}</p> : null}
                  {m.customInfo.length ? (
                    <dl className="mt-1 space-y-0.5 text-xs text-muted">
                      {m.customInfo.map((c, i) => <div key={i}><dt className="inline font-medium text-text">{c.label} : </dt><dd className="inline">{c.value}</dd></div>)}
                    </dl>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      );
    case "faq":
      return (
        <div className={cn(CARD, "p-5")}>
          <h2 className="mb-3 font-semibold">{t("page.faq")}</h2>
          <div className="divide-y divide-border">
            {data.faq.map((f, i) => (
              <details key={i} className="group py-2.5 text-sm">
                <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">{f.question}</summary>
                <p className="mt-1.5 whitespace-pre-line text-muted">{f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      );
    default:
      return null;
  }
}
