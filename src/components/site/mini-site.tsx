import type { CSSProperties } from "react";
import { Check, Clock, Facebook, Instagram, Linkedin, Mail, MapPin, MessageCircle, Phone, Star, Youtube } from "lucide-react";
import type { SocialLinks } from "@/db/schema";
import type { SiteSection, SiteTheme } from "@/lib/site-templates";
import { sanitizeArticleHtml } from "@/server/rich-text";
import { BookingFrame, SiteContactForm, SiteMobileMenu } from "@/components/site/mini-site-client";

/** Contraste WCAG : choisit le texte (blanc ou quasi-noir) le plus lisible sur une couleur. */
function lum(hex: string) {
  const c = hex.replace("#", "").match(/.{2}/g)!.map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
const onColor = (hex: string) => ((lum(hex) + 0.05) / 0.05 >= 1.05 / (lum(hex) + 0.05) ? "#111111" : "#ffffff");
const fontUrl = (fonts: string[]) => {
  const list = [...new Set(fonts.filter((f) => f && f !== "Inter"))];
  return list.length ? `https://fonts.googleapis.com/css2?${list.map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600;700`).join("&")}&display=swap` : null;
};

type Service = { id: string; name: string; description: string | null; durationMin: number; durationMaxMin: number | null; priceCents: number | null; imageUrl: string | null };
type Reviews = { count: number; average: number | null; items: { id: string; author: string; rating: number; comment: string | null }[] };
type Props = {
  site: { sections: SiteSection[]; theme: SiteTheme; logoUrl: string | null; social: SocialLinks };
  business: { id: string; name: string; slug: string; noBranding: boolean };
  content: { services: Service[]; reviews: Reviews };
  preview?: boolean;
};

const s = (v: unknown) => (typeof v === "string" ? v : "");
const arr = <T,>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);
const eur = (c: number | null) => (c == null ? null : `${(c / 100).toFixed(2).replace(".", ",").replace(",00", "")} €`);
const NAV: Partial<Record<SiteSection["type"], string>> = { services: "Prestations", about: "À propos", gallery: "Galerie", testimonials: "Avis", faq: "FAQ", contact: "Contact" };

/** Rendu public d'un site « Mon site » (aussi utilisé pour l'aperçu de l'éditeur). */
export function MiniSite({ site, business, content, preview = false }: Props) {
  const t = site.theme;
  const radius = t.roundness === "sharp" ? "4px" : t.roundness === "round" ? "999px" : "12px";
  const radiusSm = t.roundness === "sharp" ? "2px" : t.roundness === "round" ? "16px" : "8px";
  const vars = {
    "--s-primary": t.primaryColor,
    "--s-on-primary": onColor(t.primaryColor),
    "--s-bg": t.bgColor,
    "--s-text": t.textColor,
    "--s-muted": `color-mix(in srgb, ${t.textColor} 72%, ${t.bgColor})`,
    "--s-surface": `color-mix(in srgb, ${t.textColor} 4%, ${t.bgColor})`,
    "--s-border": `color-mix(in srgb, ${t.textColor} 14%, ${t.bgColor})`,
    "--s-radius": radius,
    "--s-radius-sm": radiusSm,
    "--s-font": `"${t.fontFamily}", ui-sans-serif, system-ui, sans-serif`,
    "--s-heading": `"${t.headingFont || t.fontFamily}", ui-sans-serif, system-ui, sans-serif`,
    background: t.bgColor,
    color: t.textColor,
    fontFamily: "var(--s-font)",
  } as CSSProperties;
  const sections = site.sections.filter((x) => x.enabled);
  const links = sections.filter((x) => NAV[x.type]).map((x) => ({ href: `#${x.id}`, label: NAV[x.type]! }));
  const hasBooking = sections.some((x) => x.type === "booking");
  const bookHref = hasBooking ? "#booking" : `/${business.slug}?reserver=1`;
  const fonts = fontUrl([t.fontFamily, t.headingFont ?? ""]);
  const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl" style={{ fontFamily: "var(--s-heading)" }}>{children}</h2>;
  const Btn = ({ href, children, ghost }: { href: string; children: React.ReactNode; ghost?: boolean }) => (
    <a href={href} className={ghost ? "inline-flex h-12 items-center justify-center rounded-[var(--s-radius)] border border-current px-6 text-sm font-semibold" : "inline-flex h-12 items-center justify-center rounded-[var(--s-radius)] bg-[var(--s-primary)] px-6 text-sm font-semibold text-[var(--s-on-primary)] shadow-sm transition-opacity hover:opacity-90"}>{children}</a>
  );

  return (
    <div style={vars} className="min-h-dvh">
      {fonts ? <link rel="stylesheet" href={fonts} /> : null}
      <header className="sticky top-0 z-30 border-b border-[var(--s-border)] backdrop-blur" style={{ background: `color-mix(in srgb, ${t.bgColor} 92%, transparent)` }}>
        <div className="relative mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2 font-semibold" style={{ fontFamily: "var(--s-heading)" }}>
            {site.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={site.logoUrl} alt={business.name} className="h-9 w-auto max-w-40 object-contain" />
            ) : (
              <span className="text-lg">{business.name}</span>
            )}
          </a>
          <nav aria-label="Navigation du site" className="ml-auto hidden items-center gap-1 md:flex">
            {links.map((l) => <a key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium opacity-80 hover:opacity-100">{l.label}</a>)}
            <a href={bookHref} className="ml-2 inline-flex h-10 items-center rounded-[var(--s-radius)] bg-[var(--s-primary)] px-4 text-sm font-semibold text-[var(--s-on-primary)]">Prendre rendez-vous</a>
          </nav>
          <div className="ml-auto md:hidden"><SiteMobileMenu links={links} cta="Prendre rendez-vous" /></div>
        </div>
      </header>

      <main id="top">
        {sections.map((sec) => {
          const d = sec.data;
          switch (sec.type) {
            case "hero": {
              const img = s(d.bgImage);
              const overlay = Math.min(85, Math.max(0, Number(d.overlayOpacity ?? 45)));
              const left = d.textAlign === "left";
              return (
                <section key={sec.id} id={sec.id} className="relative isolate overflow-hidden">
                  {img ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
                      <div className="absolute inset-0 -z-10" style={{ background: `rgba(0,0,0,${Math.max(overlay, 35) / 100})` }} />
                    </>
                  ) : null}
                  <div className={`mx-auto flex min-h-[60vh] max-w-6xl flex-col justify-center px-4 py-20 sm:px-6 ${left ? "items-start text-left" : "items-center text-center"}`} style={img ? { color: "#fff" } : undefined}>
                    <h1 className="max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-6xl" style={{ fontFamily: "var(--s-heading)" }}>{s(d.title) || business.name}</h1>
                    {s(d.subtitle) ? <p className="mt-5 max-w-2xl text-lg leading-relaxed opacity-90">{s(d.subtitle)}</p> : null}
                    <div className="mt-8 flex flex-wrap gap-3">
                      <Btn href={bookHref}>{s(d.ctaText) || "Prendre rendez-vous"}</Btn>
                      {sections.some((x) => x.type === "about") ? <Btn href={`#${sections.find((x) => x.type === "about")!.id}`} ghost>En savoir plus</Btn> : null}
                    </div>
                  </div>
                </section>
              );
            }
            case "services":
              return (
                <section key={sec.id} id={sec.id} className="scroll-mt-16 py-20">
                  <div className="mx-auto max-w-6xl px-4 sm:px-6">
                    <div className="mb-10 max-w-2xl"><H2>{s(d.title) || "Nos prestations"}</H2>{s(d.subtitle) ? <p className="mt-3 text-[var(--s-muted)]">{s(d.subtitle)}</p> : null}</div>
                    {content.services.length ? (
                      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {content.services.map((v) => (
                          <li key={v.id} className="flex flex-col overflow-hidden rounded-[var(--s-radius-sm)] border border-[var(--s-border)] bg-[var(--s-surface)]">
                            {v.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={v.imageUrl} alt="" className="aspect-[16/10] w-full object-cover" loading="lazy" />
                            ) : null}
                            <div className="flex flex-1 flex-col p-5">
                              <p className="font-semibold">{v.name}</p>
                              {v.description ? <p className="mt-1 line-clamp-3 text-sm text-[var(--s-muted)]">{v.description}</p> : null}
                              <p className="mt-auto flex items-center justify-between pt-4 text-sm">
                                <span className="inline-flex items-center gap-1 text-[var(--s-muted)]"><Clock className="size-3.5" aria-hidden="true" />{v.durationMaxMin ? `${v.durationMin}–${v.durationMaxMin}` : v.durationMin} min</span>
                                {eur(v.priceCents) ? <span className="font-semibold">{eur(v.priceCents)}</span> : null}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[var(--s-muted)]">Les prestations seront bientôt affichées ici.</p>
                    )}
                  </div>
                </section>
              );
            case "booking":
              return (
                <section key={sec.id} id="booking" className="scroll-mt-16 bg-[var(--s-surface)] py-20">
                  <div className="mx-auto max-w-5xl px-4 sm:px-6">
                    <div className="mb-8 text-center"><H2>{s(d.title) || "Réservez en ligne"}</H2>{s(d.subtitle) ? <p className="mt-3 text-[var(--s-muted)]">{s(d.subtitle)}</p> : null}</div>
                    <BookingFrame src={`/${business.slug}?sections=${d.embedMode === "compact" ? "" : "profile"}`} title={`Réserver chez ${business.name}`} />
                  </div>
                </section>
              );
            case "about": {
              const img = s(d.image);
              const values = arr<{ title: string; desc: string }>(d.values).filter((v) => v.title);
              return (
                <section key={sec.id} id={sec.id} className="scroll-mt-16 py-20">
                  <div className={`mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 ${img ? "lg:grid-cols-2" : ""}`}>
                    <div className={img ? "" : "max-w-3xl"}>
                      {s(d.subtitle) ? <p className="text-sm font-semibold tracking-wide text-[var(--s-muted)] uppercase">{s(d.subtitle)}</p> : null}
                      <div className="mt-2"><H2>{s(d.title) || "À propos"}</H2></div>
                      <div className="prose-article mt-5 text-[var(--s-muted)] [&_a]:text-current [&_strong]:text-[var(--s-text)]" dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(s(d.text)) }} />
                    </div>
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" className="aspect-[4/3] w-full rounded-[var(--s-radius-sm)] object-cover" loading="lazy" />
                    ) : null}
                  </div>
                  {values.length ? (
                    <ul className="mx-auto mt-12 grid max-w-6xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
                      {values.map((v) => (
                        <li key={v.title} className="rounded-[var(--s-radius-sm)] border border-[var(--s-border)] bg-[var(--s-surface)] p-5">
                          <span className="flex size-9 items-center justify-center rounded-full bg-[var(--s-primary)] text-[var(--s-on-primary)]"><Check className="size-4" aria-hidden="true" /></span>
                          <p className="mt-3 font-semibold">{v.title}</p>
                          <p className="mt-1 text-sm text-[var(--s-muted)]">{v.desc}</p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              );
            }
            case "gallery": {
              const imgs = arr<{ url: string; caption?: string }>(d.images).filter((i) => i.url);
              if (!imgs.length) return null;
              const cols = d.columns === "2" ? "sm:grid-cols-2" : d.columns === "4" ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";
              return (
                <section key={sec.id} id={sec.id} className="scroll-mt-16 py-20">
                  <div className="mx-auto max-w-6xl px-4 sm:px-6">
                    {s(d.title) ? <div className="mb-10"><H2>{s(d.title)}</H2></div> : null}
                    <ul className={`grid gap-4 ${cols}`}>
                      {imgs.map((i) => (
                        <li key={i.url}>
                          <figure>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={i.url} alt={i.caption || ""} className="aspect-[4/3] w-full rounded-[var(--s-radius-sm)] object-cover" loading="lazy" />
                            {i.caption ? <figcaption className="mt-2 text-sm text-[var(--s-muted)]">{i.caption}</figcaption> : null}
                          </figure>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              );
            }
            case "testimonials": {
              const manual = d.source === "manual" ? arr<{ name: string; rating: number; text: string }>(d.items).filter((i) => i.text) : [];
              const items = d.source === "manual" ? manual.map((m, i) => ({ id: String(i), author: m.name, rating: m.rating || 5, comment: m.text })) : content.reviews.items;
              if (!items.length) return null;
              return (
                <section key={sec.id} id={sec.id} className="scroll-mt-16 bg-[var(--s-surface)] py-20">
                  <div className="mx-auto max-w-6xl px-4 sm:px-6">
                    <div className="mb-10">
                      <H2>{s(d.title) || "Avis de nos clients"}</H2>
                      {d.source !== "manual" && content.reviews.average ? <p className="mt-3 inline-flex items-center gap-1.5 text-[var(--s-muted)]"><Star className="size-4 fill-current" aria-hidden="true" />{String(content.reviews.average).replace(".", ",")} / 5 · {content.reviews.count} avis vérifiés</p> : null}
                    </div>
                    <ul className="grid gap-4 md:grid-cols-3">
                      {items.slice(0, 6).map((r) => (
                        <li key={r.id} className="rounded-[var(--s-radius-sm)] border border-[var(--s-border)] bg-[var(--s-bg)] p-5">
                          <p className="flex gap-0.5" aria-label={`${r.rating} sur 5`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} className={`size-4 ${i < r.rating ? "fill-current" : "opacity-30"}`} aria-hidden="true" />)}</p>
                          <p className="mt-3 text-[15px] leading-relaxed">« {r.comment} »</p>
                          <p className="mt-3 text-sm font-semibold">{r.author}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              );
            }
            case "faq": {
              const items = arr<{ question: string; answer: string }>(d.items).filter((i) => i.question);
              if (!items.length) return null;
              return (
                <section key={sec.id} id={sec.id} className="scroll-mt-16 py-20">
                  <div className="mx-auto max-w-3xl px-4 sm:px-6">
                    <div className="mb-8"><H2>{s(d.title) || "Questions fréquentes"}</H2></div>
                    <div className="divide-y divide-[var(--s-border)] rounded-[var(--s-radius-sm)] border border-[var(--s-border)]">
                      {items.map((i) => (
                        <details key={i.question} className="group px-5 py-4">
                          <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">{i.question}</summary>
                          <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line text-[var(--s-muted)]">{i.answer}</p>
                        </details>
                      ))}
                    </div>
                  </div>
                </section>
              );
            }
            case "stats": {
              const items = arr<{ number: string; label: string }>(d.items).filter((i) => i.number);
              if (!items.length) return null;
              return (
                <section key={sec.id} id={sec.id} className="py-16">
                  <div className="mx-auto max-w-6xl px-4 sm:px-6">
                    {s(d.title) ? <div className="mb-8 text-center"><H2>{s(d.title)}</H2></div> : null}
                    <dl className="grid grid-cols-2 gap-6 lg:grid-cols-4">
                      {items.map((i) => (
                        <div key={i.label} className="rounded-[var(--s-radius-sm)] border border-[var(--s-border)] bg-[var(--s-surface)] p-5 text-center">
                          <dd className="text-3xl font-semibold" style={{ fontFamily: "var(--s-heading)" }}>{i.number}</dd>
                          <dt className="mt-1 text-sm text-[var(--s-muted)]">{i.label}</dt>
                        </div>
                      ))}
                    </dl>
                  </div>
                </section>
              );
            }
            case "cta":
              return (
                <section key={sec.id} id={sec.id} className="py-16">
                  <div className="mx-auto max-w-5xl px-4 sm:px-6">
                    <div className="rounded-[var(--s-radius-sm)] bg-[var(--s-primary)] px-6 py-12 text-center text-[var(--s-on-primary)]">
                      <h2 className="text-3xl font-semibold tracking-tight text-balance" style={{ fontFamily: "var(--s-heading)" }}>{s(d.title)}</h2>
                      {s(d.text) ? <p className="mx-auto mt-3 max-w-2xl opacity-90">{s(d.text)}</p> : null}
                      {s(d.buttonText) ? <a href={s(d.buttonUrl) || bookHref} className="mt-6 inline-flex h-12 items-center rounded-[var(--s-radius)] bg-[var(--s-on-primary)] px-6 text-sm font-semibold text-[var(--s-primary)]">{s(d.buttonText)}</a> : null}
                    </div>
                  </div>
                </section>
              );
            case "contact":
              return (
                <section key={sec.id} id={sec.id} className="scroll-mt-16 bg-[var(--s-surface)] py-20">
                  <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
                    <div>
                      <H2>{s(d.title) || "Nous trouver"}</H2>
                      <ul className="mt-6 space-y-4">
                        {s(d.address) ? <li className="flex gap-3"><MapPin className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s(d.address))}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{s(d.address)}</a></li> : null}
                        {s(d.phone) ? <li className="flex gap-3"><Phone className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><a href={`tel:${s(d.phone).replace(/\s/g, "")}`} className="hover:underline">{s(d.phone)}</a></li> : null}
                        {s(d.email) ? <li className="flex gap-3"><Mail className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><a href={`mailto:${s(d.email)}`} className="hover:underline">{s(d.email)}</a></li> : null}
                      </ul>
                      {s(d.address) ? (
                        <iframe title={`Plan — ${business.name}`} src={`https://www.google.com/maps?q=${encodeURIComponent(s(d.address))}&output=embed`} className="mt-6 h-60 w-full rounded-[var(--s-radius-sm)] border border-[var(--s-border)]" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                      ) : null}
                    </div>
                    {d.showForm !== false ? (
                      <div className="rounded-[var(--s-radius-sm)] border border-[var(--s-border)] bg-[var(--s-bg)] p-6">
                        <p className="mb-4 font-semibold">Écrivez-nous</p>
                        <SiteContactForm businessId={business.id} preview={preview} />
                      </div>
                    ) : null}
                  </div>
                </section>
              );
            default:
              return null;
          }
        })}
      </main>

      <footer className="border-t border-[var(--s-border)] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-sm text-[var(--s-muted)] sm:flex-row sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} {business.name}</p>
          <ul className="flex gap-2">
            {site.social.instagram ? <li><a href={site.social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="flex size-10 items-center justify-center rounded-full border border-[var(--s-border)]"><Instagram className="size-4" aria-hidden="true" /></a></li> : null}
            {site.social.facebook ? <li><a href={site.social.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex size-10 items-center justify-center rounded-full border border-[var(--s-border)]"><Facebook className="size-4" aria-hidden="true" /></a></li> : null}
            {site.social.linkedin ? <li><a href={site.social.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="flex size-10 items-center justify-center rounded-full border border-[var(--s-border)]"><Linkedin className="size-4" aria-hidden="true" /></a></li> : null}
            {site.social.youtube ? <li><a href={site.social.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="flex size-10 items-center justify-center rounded-full border border-[var(--s-border)]"><Youtube className="size-4" aria-hidden="true" /></a></li> : null}
            {site.social.tiktok ? <li><a href={site.social.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="flex h-10 items-center justify-center rounded-full border border-[var(--s-border)] px-3 text-xs font-semibold">TikTok</a></li> : null}
            {site.social.whatsapp ? <li><a href={`https://wa.me/${site.social.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="flex size-10 items-center justify-center rounded-full border border-[var(--s-border)]"><MessageCircle className="size-4" aria-hidden="true" /></a></li> : null}
          </ul>
          {!business.noBranding ? <a href="https://branshee.com" className="hover:underline">Réservation en ligne par Branshee</a> : null}
        </div>
      </footer>
    </div>
  );
}
