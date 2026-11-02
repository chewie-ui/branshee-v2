import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { MapPin, Phone } from "lucide-react";

type Biz = { name: string; slug: string; city: string | null; address: string | null; postalCode: string | null; phone: string | null; photoUrl: string | null; theme: { accentColor?: string; accentText?: string } | null };

const hex = (c: string | undefined) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : null);

/** Couleur de l'entreprise (thème de sa page) appliquée aux boutons de la vitrine. */
export function themeStyle(b: Biz): CSSProperties {
  const accent = hex(b.theme?.accentColor);
  const text = hex(b.theme?.accentText);
  return accent ? ({ "--accent": accent, "--accent-hover": accent, "--accent-foreground": text ?? "#ffffff" } as CSSProperties) : {};
}

/** Cadre des pages publiques de la vitrine véhicules : en-tête du garage, pied de page. */
export function VehicleShell({ business, children }: { business: Biz; children: ReactNode }) {
  const addr = [business.address, [business.postalCode, business.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return (
    <div className="min-h-dvh bg-background" style={themeStyle(business)}>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href={`/vehicules/${business.slug}`} className="flex min-w-0 items-center gap-3">
            {business.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo téléversé
              <img src={business.photoUrl} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent font-semibold text-accent-foreground" aria-hidden="true">{business.name.charAt(0).toUpperCase()}</span>
            )}
            <span className="min-w-0">
              <span className="block truncate font-semibold">{business.name}</span>
              {business.city ? <span className="block truncate text-xs text-muted">{business.city}</span> : null}
            </span>
          </Link>
          {business.phone ? (
            <a href={`tel:${business.phone.replace(/[^+0-9]/g, "")}`} className="ml-auto inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-sm font-medium hover:bg-surface-muted">
              <Phone className="size-4" aria-hidden="true" /><span className="hidden sm:inline">{business.phone}</span><span className="sm:hidden">Appeler</span>
            </a>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>{business.name}{addr ? <> · <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-text"><MapPin className="size-3.5" aria-hidden="true" />{addr}</a></> : null}</span>
          <a href="https://skydev.be" className="hover:text-text">Vitrine propulsée par skydev</a>
        </div>
      </footer>
    </div>
  );
}
