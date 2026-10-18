import Link from "next/link";
import { Brand } from "@/components/brand";
import { METIERS } from "@/lib/seo-landing";

const COLS = [
  { title: "Produit", links: [{ href: "/#fonctionnalites", label: "Fonctionnalités" }, { href: "/tarifs", label: "Tarifs" }, { href: "/inscription", label: "Créer mon agenda" }, { href: "/connexion", label: "Connexion" }] },
  { title: "Ressources", links: [{ href: "/blog", label: "Blog" }, { href: "/annuaire", label: "Trouver un professionnel" }, { href: "/logiciel-rendez-vous", label: "Par métier et par ville" }, { href: "/contact", label: "Contact" }] },
  { title: "Légal", links: [{ href: "/confidentialite", label: "Confidentialité" }, { href: "/conditions-utilisation", label: "Conditions d'utilisation" }] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Brand />
          <p className="mt-3 max-w-xs text-sm text-muted">La prise de rendez-vous en ligne pour les indépendants et les petites équipes. Sans commission, conçue en Belgique.</p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <p className="text-sm font-semibold">{c.title}</p>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l.href}><Link href={l.href} className="text-sm text-muted hover:text-text">{l.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-4 gap-y-2 px-4 py-5 text-xs text-muted sm:px-6">
          <span>© {new Date().getFullYear()} Branshee</span>
          {METIERS.slice(0, 6).map((m) => (
            <Link key={m.slug} href={`/logiciel-rendez-vous/${m.slug}-bruxelles`} className="hover:text-text">Logiciel {m.nom}</Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
