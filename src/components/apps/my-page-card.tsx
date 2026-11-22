import Link from "next/link";
import { ExternalLink, Globe2, LayoutTemplate, Palette, QrCode } from "lucide-react";
import { CopyLink } from "@/components/app/copy-link";
import { OnlineSwitches } from "@/components/online/online-switches";
import { makeT, type AppLocale } from "@/lib/i18n/app";
import { cn } from "@/lib/cn";
import type { OnlineItem } from "@/server/online";

/**
 * Accueil Skydev : raccourci « Ma page en ligne ». L'adresse publique, ce que les visiteurs y voient
 * (page de réservation ou site web), et les interrupteurs pour couper / remettre en ligne sans passer par une app.
 */
export function MyPageCard({ url, items, hasSiteApp, locale = "fr" }: { url: string; items: OnlineItem[]; hasSiteApp: boolean; locale?: AppLocale }) {
  const t = makeT(locale);
  const booking = items.find((i) => i.kind === "booking");
  const siteOn = items.some((i) => i.kind === "site" && i.on);
  const live = siteOn || !!booking?.on;
  const links = [
    { href: url, label: t("Voir ma page"), icon: ExternalLink, external: true },
    { href: "/app/page-de-reservation/apparence", label: t("Personnaliser"), icon: Palette },
    { href: "/app/page-de-reservation/partager", label: t("Adresse et QR code"), icon: QrCode },
    ...(hasSiteApp ? [{ href: "/app/site", label: t("Site web"), icon: LayoutTemplate }] : []),
  ];
  return (
    <section className="mx-auto mb-8 max-w-3xl overflow-hidden rounded-2xl border border-border bg-surface" aria-labelledby="my-page">
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground" aria-hidden="true"><Globe2 className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="my-page" className="font-semibold">{t("Ma page en ligne")}</h2>
            <p className="mt-0.5 text-sm text-muted">
              {siteOn
                ? t("À cette adresse, vos visiteurs voient votre site web, avec la prise de rendez-vous intégrée.")
                : t("À cette adresse, vos visiteurs voient votre page de prise de rendez-vous.")}
            </p>
          </div>
          <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", live ? "bg-success-soft text-success" : "bg-surface-muted text-muted")}>{live ? t("En ligne") : t("En pause")}</span>
        </div>
        <CopyLink url={url} />
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} target={l.external ? "_blank" : undefined} rel={l.external ? "noopener" : undefined} className="inline-flex min-h-11 items-center gap-1.5 font-medium text-accent hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              <l.icon className="size-4" aria-hidden="true" />
              {l.label}
            </Link>
          ))}
        </div>
      </div>
      {items.length ? (
        <div className="border-t border-border">
          <OnlineSwitches items={items} />
        </div>
      ) : null}
    </section>
  );
}
