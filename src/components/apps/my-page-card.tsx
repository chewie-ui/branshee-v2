import Link from "next/link";
import { ChevronDown, ExternalLink, Globe2, PenLine, Palette, QrCode } from "lucide-react";
import { CopyLink } from "@/components/app/copy-link";
import { OnlineSwitches } from "@/components/online/online-switches";
import { makeT, type AppLocale } from "@/lib/i18n/app";
import { cn } from "@/lib/cn";
import type { OnlineItem } from "@/server/online";

/**
 * Accueil Skydev (sous les apps) : raccourci « Ma page en ligne ». L'adresse publique et ce que les visiteurs
 * y voient ; les interrupteurs (réservation, site, boutique) sont repliés dans « Mettre en ligne ou couper ».
 */
export function MyPageCard({ url, items, locale = "fr" }: { url: string; items: OnlineItem[]; hasSiteApp?: boolean; locale?: AppLocale }) {
  const t = makeT(locale);
  const booking = items.find((i) => i.kind === "booking");
  const siteOn = items.some((i) => i.kind === "site" && i.on);
  const live = siteOn || !!booking?.on;
  const links = [
    { href: url, label: t("Voir"), icon: ExternalLink, external: true },
    { href: "/app/page-de-reservation/partager#adresse", label: t("Changer l'adresse"), icon: PenLine },
    { href: "/app/page-de-reservation/apparence", label: t("Personnaliser"), icon: Palette },
    { href: "/app/page-de-reservation/partager", label: t("QR code"), icon: QrCode },
  ];
  return (
    <section className="rounded-2xl border border-border bg-surface" aria-labelledby="my-page">
      <div className="space-y-3 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground" aria-hidden="true"><Globe2 className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="my-page" className="font-semibold">{t("Ma page en ligne")}</h2>
            <p className="mt-0.5 text-sm text-muted">{siteOn ? t("Vos visiteurs voient votre site web, avec la réservation.") : t("Vos visiteurs voient votre page de prise de rendez-vous.")}</p>
          </div>
          <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", live ? "bg-success-soft text-success" : "bg-surface-muted text-muted")}>{live ? t("En ligne") : t("En pause")}</span>
        </div>
        <CopyLink url={url} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {links.map((l) => (
            <Link key={l.label} href={l.href} target={l.external ? "_blank" : undefined} rel={l.external ? "noopener" : undefined} className="inline-flex min-h-11 items-center gap-1.5 font-medium text-accent hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:min-h-8">
              <l.icon className="size-4" aria-hidden="true" />
              {l.label}
            </Link>
          ))}
        </div>
      </div>
      {items.length ? (
        <details className="group border-t border-border">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-5 py-2 text-sm font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
            <span className="flex-1">{t("Mettre en ligne ou couper")}</span>
            <span className="text-xs text-muted">{t("{on} sur {total} en ligne", { on: items.filter((i) => i.on).length, total: items.length })}</span>
            <ChevronDown className="size-4 text-muted transition-transform duration-150 group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="border-t border-border">
            <OnlineSwitches items={items} />
          </div>
        </details>
      ) : null}
    </section>
  );
}
