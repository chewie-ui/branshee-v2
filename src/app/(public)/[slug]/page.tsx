import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, Globe, Mail, MapPin, Phone } from "lucide-react";
import { format } from "date-fns";
import { BookingFlow } from "@/components/booking/booking-flow";
import { Avatar } from "@/components/ui/avatar";
import { zoned } from "@/lib/time";
import { getPublicBusiness } from "@/server/public";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const data = await getPublicBusiness((await params).slug);
  if (!data) return { title: "Établissement introuvable" };
  const { business: b } = data;
  return {
    title: `${b.name} — Prendre rendez-vous`,
    description: b.description ?? `Réservez en ligne chez ${b.name}${b.city ? ` à ${b.city}` : ""}.`,
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

export default async function PublicBusinessPage({ params }: { params: Params }) {
  const data = await getPublicBusiness((await params).slug);
  if (!data) notFound();
  const { business: b, team, hours, faq } = data;
  // Couleur de l'établissement : remplace l'accent du thème sur toute la page.
  const accent = data.accentColor && /^#[0-9a-f]{6}$/i.test(data.accentColor) ? data.accentColor : null;
  const themeStyle = accent ? ({ "--accent": accent, "--accent-hover": accent, "--accent-soft": `${accent}14`, "--accent-soft-foreground": accent } as React.CSSProperties) : undefined;
  const today = format(zoned(new Date(), b.timezone), "yyyy-MM-dd");
  const address = [b.address, [b.postalCode, b.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return (
    <div className="min-h-dvh" style={themeStyle}>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-6 sm:px-6">
          <Avatar name={b.name} src={b.photoUrl} size="lg" className="size-14 text-base" />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{b.name}</h1>
            <p className="text-sm text-muted">{[b.businessType, b.city].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_320px] lg:py-10">
        <section className="min-w-0 rounded-xl border border-border bg-surface p-5 sm:p-6" aria-label="Réservation">
          {b.pausedAt ? (
            <div className="py-8 text-center">
              <p className="font-semibold">Réservations en ligne suspendues</p>
              <p className="mt-1 text-sm text-muted">Contactez directement l&apos;établissement pour prendre rendez-vous.</p>
            </div>
          ) : (
            <BookingFlow data={data} today={today} />
          )}
        </section>

        <aside className="space-y-4">
          {b.description ? (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h2 className="mb-2 font-semibold">À propos</h2>
              <p className="text-sm whitespace-pre-line text-muted">{b.description}</p>
            </div>
          ) : null}

          <div className="space-y-3 rounded-xl border border-border bg-surface p-5 text-sm">
            <h2 className="font-semibold">Infos pratiques</h2>
            {address ? (
              <p className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.name} ${address}`)}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover">
                  {address}
                </a>
              </p>
            ) : null}
            {b.phone ? (
              <p className="flex gap-3">
                <Phone className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                <a href={`tel:${b.phone}`} className="text-accent hover:text-accent-hover">{b.phone}</a>
              </p>
            ) : null}
            {b.email ? (
              <p className="flex gap-3">
                <Mail className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                <a href={`mailto:${b.email}`} className="truncate text-accent hover:text-accent-hover">{b.email}</a>
              </p>
            ) : null}
            {b.website ? (
              <p className="flex gap-3">
                <Globe className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                <a href={b.website} target="_blank" rel="noopener noreferrer" className="truncate text-accent hover:text-accent-hover">{b.website.replace(/^https?:\/\//, "")}</a>
              </p>
            ) : null}
          </div>

          {hours.length ? (
            <div className="rounded-xl border border-border bg-surface p-5 text-sm">
              <h2 className="mb-3 flex items-center gap-2 font-semibold">
                <Clock className="size-4 text-muted" aria-hidden="true" />
                Horaires
              </h2>
              <dl className="space-y-1.5">
                {DAYS.map((d) => {
                  const ranges = hours.filter((h) => h.weekday === d.wd);
                  return (
                    <div key={d.wd} className="flex justify-between gap-4">
                      <dt className="text-muted">{d.label}</dt>
                      <dd className="text-right tabular-nums">{ranges.length ? ranges.map((r) => `${r.start}–${r.end}`).join(", ") : "Fermé"}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ) : null}

          {faq.length ? (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h2 className="mb-3 font-semibold">Questions fréquentes</h2>
              <div className="divide-y divide-border">
                {faq.map((f, i) => (
                  <details key={i} className="group py-2.5 text-sm">
                    <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">{f.question}</summary>
                    <p className="mt-1.5 whitespace-pre-line text-muted">{f.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          ) : null}

          {team.length > 1 ? (
            <div className="rounded-xl border border-border bg-surface p-5">
              <h2 className="mb-3 font-semibold">L&apos;équipe</h2>
              <ul className="space-y-3">
                {team.map((m) => (
                  <li key={m.id} className="flex items-center gap-3">
                    <Avatar name={m.name} src={m.photoUrl} />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{m.name}</p>
                      {m.role ? <p className="truncate text-muted">{m.role}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </main>

      <footer className="pb-8 text-center text-xs text-muted">
        Réservation en ligne propulsée par <span className="font-medium text-text">Branshee</span>
      </footer>
    </div>
  );
}
