import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Clock, Facebook, Globe, Instagram, Languages, Linkedin, Mail, MapPin, MessageCircle, Phone, Star, Video, Youtube } from "lucide-react";
import { format } from "date-fns";
import { BookingFlow } from "@/components/booking/booking-flow";
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

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type Search = Promise<{ sections?: string; apercu?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const data = await getPublicBusiness((await params).slug);
  if (!data) return { title: "Établissement introuvable" };
  const { business: b } = data;
  const about = b.description ?? (data.aboutHtml ? richTextToPlain(data.aboutHtml).slice(0, 160) : null);
  return {
    title: `${b.name} — Prendre rendez-vous`,
    description: about ?? `Réservez en ligne chez ${b.name}${b.city ? ` à ${b.city}` : ""}.`,
    openGraph: b.photoUrl ? { images: [b.photoUrl] } : undefined,
  };
}

const DAYS = [
  { wd: 1, label: "Lundi" },
  { wd: 2, label: "Mardi" },
  { wd: 3, label: "Mercredi" },
  { wd: 4, label: "Jeudi" },
  { wd: 5, label: "Vendredi" },
  { wd: 6, label: "Samedi" },
  { wd: 0, label: "Dimanche" },
];

const CARD = "rounded-xl border border-border bg-surface shadow-[var(--card-shadow)]";

type ReviewCtx = { state: "hidden" } | { state: "anon" | "unverified" | "can" | "own" | "done"; slug: string };

/** « Ouvert aujourd'hui » à partir des horaires communs et d'une éventuelle fermeture exceptionnelle. */
function todayStatus(data: PublicBusiness): { open: boolean; label: string } | null {
  if (!data.hours.length) return null;
  const wd = Number(format(zoned(new Date(), data.business.timezone), "i")) % 7;
  const ex = data.todayException;
  const ranges = ex ? (ex.isClosed ? [] : ex.hours) : data.hours.filter((h) => h.weekday === wd);
  if (!ranges.length) return { open: false, label: "Fermé aujourd'hui" };
  return { open: true, label: `Ouvert aujourd'hui · ${ranges.map((r) => `${r.start}–${r.end}`).join(", ")}` };
}

/** Établissement en pause : page dédiée, avec les coordonnées pour joindre le pro. */
function PausedPage({ data }: { data: PublicBusiness }) {
  const b = data.business;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10 text-center">
      <Avatar name={b.name} src={b.photoUrl} size="lg" className="size-16 text-lg" />
      <h1 className="mt-4 text-2xl font-semibold">{b.name}</h1>
      <p className="mt-2 max-w-md text-muted">La réservation en ligne est momentanément suspendue. Contactez directement l&apos;établissement pour prendre rendez-vous.</p>
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
  const data = await getPublicBusiness((await params).slug);
  if (!data) notFound();
  const sp = await searchParams;
  const { business: b, theme } = data;
  const today = format(zoned(new Date(), b.timezone), "yyyy-MM-dd");
  if (b.pausedAt) return <PausedPage data={data} />;
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

  const aside = asideSections.filter((s) => hasContent(s, data)).map((s) => <SectionBlock key={s} kind={s} data={data} review={review} />);

  return (
    <div
      id="bp-root"
      data-layout={theme.layout}
      className="group min-h-dvh bg-cover bg-fixed bg-center text-text"
      style={{ ...(vars as React.CSSProperties), background: undefined, backgroundColor: "var(--background)", backgroundImage: theme.pageBgImage ? `url("${theme.pageBgImage}")` : undefined, fontFamily: "var(--font-sans)" }}
    >
      {fontHref ? <link rel="stylesheet" href={fontHref} /> : null}

      {showProfile ? <ProfileHeader data={data} /> : null}

      <main className={cn("mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6", aside.length ? "lg:grid-cols-[1fr_320px]" : "max-w-3xl", embedded ? "lg:py-6" : "lg:py-10")}>
        <section className={cn(CARD, "min-w-0 p-5 sm:p-6")} aria-label="Réservation">
          {embedded && data.embed.title ? <h2 className="mb-4 text-xl font-semibold">{data.embed.title}</h2> : null}
          <BookingFlow data={data} today={today} viewer={session ? { firstName: session.user.fullName.split(" ")[0] ?? "", lastName: session.user.fullName.split(" ").slice(1).join(" "), email: session.user.email, phone: session.user.phone ?? "" } : null} />
        </section>

        {aside.length ? <aside className="space-y-4 lg:group-data-[layout=split]:order-first">{aside}</aside> : null}
      </main>

      {!embedded ? (
        <footer className="pb-8 text-center text-xs text-muted">
          Réservation en ligne propulsée par <span className="font-medium text-text">Branshee</span>
        </footer>
      ) : null}
      <EmbedResize />
      {sp.apercu === "1" ? <ThemePreview /> : null}
    </div>
  );
}

function ProfileHeader({ data }: { data: PublicBusiness }) {
  const { business: b, showContact: show } = data;
  const links: { key: string; href: string; label: string; icon: ReactNode }[] = [];
  if (b.phone && show.phone) links.push({ key: "phone", href: `tel:${b.phone.replace(/\s/g, "")}`, label: b.phone, icon: <Phone className="size-4" aria-hidden="true" /> });
  if (b.email && show.email) links.push({ key: "email", href: `mailto:${b.email}`, label: b.email, icon: <Mail className="size-4" aria-hidden="true" /> });
  if (b.website && show.website) links.push({ key: "website", href: b.website, label: b.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), icon: <Globe className="size-4" aria-hidden="true" /> });
  const socials: { key: string; label: string; icon: ReactNode; on: boolean }[] = [
    { key: "instagram", label: "Instagram", icon: <Instagram className="size-4" aria-hidden="true" />, on: show.instagram },
    { key: "facebook", label: "Facebook", icon: <Facebook className="size-4" aria-hidden="true" />, on: show.facebook },
    { key: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="size-4" aria-hidden="true" />, on: show.whatsapp },
    { key: "tiktok", label: "TikTok", icon: <Video className="size-4" aria-hidden="true" />, on: true },
    { key: "linkedin", label: "LinkedIn", icon: <Linkedin className="size-4" aria-hidden="true" />, on: true },
    { key: "youtube", label: "YouTube", icon: <Youtube className="size-4" aria-hidden="true" />, on: true },
  ];
  const social = b.social as Record<string, string | undefined>;

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="flex items-center gap-4">
          <Avatar name={b.name} src={b.photoUrl} size="lg" className="size-16 text-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{b.name}</h1>
            <p className="text-sm text-muted">{[b.businessType, b.locationMode === "online" ? "En ligne" : b.city].filter(Boolean).join(" · ")}</p>
            {(() => {
              const t = todayStatus(data);
              return t ? <p className={cn("mt-0.5 text-sm font-medium", t.open ? "text-success" : "text-muted")}>{t.label}</p> : null;
            })()}
            {data.reviews.count > 0 && data.reviews.average != null ? (
              <p className="mt-0.5 flex items-center gap-1 text-sm">
                <Star className="size-4 fill-current text-warning" aria-hidden="true" />
                <span className="font-medium">{data.reviews.average.toFixed(1).replace(".", ",")}</span>
                <span className="text-muted">({data.reviews.count} avis)</span>
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
                {l.key !== "website" ? <CopyButton value={l.label} label={l.key === "phone" ? "le numéro" : "l'email"} /> : null}
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

function SectionBlock({ kind, data, review }: { kind: string; data: PublicBusiness; review: ReviewCtx }) {
  const b = data.business;
  if (!hasContent(kind, data)) return null;
  const address = [b.address, [b.postalCode, b.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const langs = b.languages.map((c) => LANGUAGE_NAMES[c] ?? c);

  switch (kind) {
    case "about":
      return (
        <div className={cn(CARD, "p-5")}>
          <h2 className="mb-2 font-semibold">À propos</h2>
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
          <h2 className="font-semibold">{b.locationMode === "online" ? "Consultation en ligne" : "Adresse"}</h2>
          {b.locationMode === "online" ? (
            <p className="flex gap-3 text-muted">
              <Video className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Rendez-vous à distance{b.country ? ` · ${b.country}` : ""}
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
            <iframe title={`Carte — ${b.name}`} src={b.mapEmbedUrl} className="h-52 w-full rounded-lg border border-border" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          ) : b.locationMode === "on_site" && address ? (
            <iframe title={`Carte — ${b.name}`} src={`https://www.google.com/maps?q=${encodeURIComponent([address, b.country].filter(Boolean).join(", "))}&output=embed`} className="h-52 w-full rounded-lg border border-border" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          ) : null}
        </div>
      );
    case "hours":
      return (
        <div className={cn(CARD, "p-5 text-sm")}>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Clock className="size-4 text-muted" aria-hidden="true" />
            Horaires
          </h2>
          <dl className="space-y-1.5">
            {DAYS.map((d) => {
              const ranges = data.hours.filter((h) => h.weekday === d.wd);
              return (
                <div key={d.wd} className="flex justify-between gap-4">
                  <dt className="text-muted">{d.label}</dt>
                  <dd className="text-right tabular-nums">{ranges.length ? ranges.map((r) => `${r.start}–${r.end}`).join(", ") : "Fermé"}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      );
    case "gallery":
      return (
        <div className={cn(CARD, "p-5")}>
          <h2 className="mb-3 font-semibold">Galerie</h2>
          <Gallery images={data.gallery} layout={data.galleryLayout} name={b.name} />
        </div>
      );
    case "reviews":
      return (
        <div id="avis" className={cn(CARD, "scroll-mt-6 p-5")}>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            Avis clients
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
                    <span className="flex text-warning" aria-label={`${r.rating} sur 5`}>
                      {Array.from({ length: 5 }, (_, i) => <Star key={i} className={cn("size-3.5", i < r.rating ? "fill-current" : "opacity-30")} aria-hidden="true" />)}
                    </span>
                  </p>
                  {r.comment ? <p className="mt-0.5 text-muted">{r.comment}</p> : null}
                  <ReportReviewButton reviewId={r.id} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Pas encore d&apos;avis. Soyez le premier !</p>
          )}
          <div className="mt-4">
            {review.state === "can" ? <ReviewForm slug={review.slug} /> : null}
            {review.state === "anon" ? (
              <p className="text-sm text-muted">
                <Link href={`/connexion?suite=${encodeURIComponent(`/${review.slug}#avis`)}`} className="font-medium text-accent hover:text-accent-hover">Connectez-vous</Link> pour laisser un avis.
              </p>
            ) : null}
            {review.state === "unverified" ? (
              <p className="text-sm text-muted">
                <Link href={`/verifier-email?suite=${encodeURIComponent(`/${review.slug}#avis`)}`} className="font-medium text-accent hover:text-accent-hover">Confirmez votre email</Link> pour laisser un avis.
              </p>
            ) : null}
            {review.state === "done" ? <p className="text-sm text-muted">Merci, vous avez déjà donné votre avis.</p> : null}
          </div>
        </div>
      );
    case "team":
      return (
        <div className={cn(CARD, "p-5")}>
          <h2 className="mb-3 font-semibold">L&apos;équipe</h2>
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
          <h2 className="mb-3 font-semibold">Questions fréquentes</h2>
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
