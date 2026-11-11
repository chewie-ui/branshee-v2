import type { ReactNode } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { LEGAL, legalAddress } from "@/lib/legal";
import { alternatePath } from "@/lib/site-alternate";
import type { SiteLocale } from "@/lib/site-locale";
import { LocaleGuard } from "./locale-guard";
import "./skydev.css";

type L = { href: string; label: string };
const T: Record<SiteLocale, {
  skip: string; promo: [string, string]; tryIt: string; home: string; mainNav: string; mobileNav: string; nav: L[];
  space: string; demo: string; login: string; signup: [string, string]; tagline: string;
  cols: { title: string; links: L[] }[]; contact: string; place: string; legal: string; lang: string; langLabel: string;
}> = {
  fr: {
    skip: "Aller au contenu", promo: ["1er mois offert : 0 €", ", sans carte bancaire et sans engagement."], tryIt: "Essayer gratuitement", home: "Skydev, accueil",
    mainNav: "Navigation principale", mobileNav: "Navigation principale (mobile)",
    nav: [{ href: "/apps", label: "Apps" }, { href: "/sur-mesure", label: "Sur mesure" }, { href: "/#realisations", label: "Réalisations" }, { href: "/#tarifs", label: "Tarifs" }, { href: "/annuaire", label: "Trouver un pro" }],
    space: "Mon espace", demo: "Voir la démo", login: "Se connecter", signup: ["Créer mon compte", "S'inscrire"],
    tagline: "Le logiciel de votre entreprise, composé app par app. Conçu à Wavre.",
    cols: [
      { title: "Sur mesure", links: [{ href: "/sur-mesure/creation-site-internet", label: "Création de site" }, { href: "/sur-mesure/creation-site-internet/wavre", label: "Site internet à Wavre" }, { href: "/sur-mesure/boutique-en-ligne", label: "Boutique en ligne" }, { href: "/sur-mesure/application-web-saas", label: "Apps web et SaaS" }, { href: "/sur-mesure/application-mobile", label: "Application mobile" }] },
      { title: "Apps", links: [{ href: "/apps", label: "Toutes les apps" }, { href: "/apps/rendez-vous", label: "Rendez-vous en ligne" }, { href: "/apps/factures", label: "Devis et factures" }, { href: "/apps/caisse", label: "Caisse" }, { href: "/apps/site-web", label: "Site web" }, { href: "/logiciel/garage", label: "Logiciel pour garage" }, { href: "/logiciel/kine", label: "Logiciel pour kiné" }] },
      { title: "Skydev", links: [{ href: "/annuaire", label: "Trouver un professionnel" }, { href: "/annuaire/coiffeur/wavre", label: "Coiffeur à Wavre" }, { href: "/annuaire/kine/wavre", label: "Kiné à Wavre" }, { href: "/sur-mesure", label: "Sur mesure" }, { href: "/#tarifs", label: "Tarifs" }, { href: "/connexion", label: "Se connecter" }, { href: "/conditions-utilisation", label: "Conditions" }, { href: "/confidentialite", label: "Confidentialité" }] },
    ],
    contact: "Contact", place: "Wavre, Belgique", legal: "entreprise personne physique", lang: "English", langLabel: "View this page in English",
  },
  en: {
    skip: "Skip to content", promo: ["First month free: €0", ", no credit card, no commitment."], tryIt: "Try it for free", home: "Skydev, home",
    mainNav: "Main navigation", mobileNav: "Main navigation (mobile)",
    nav: [{ href: "/sur-mesure", label: "Custom work" }, { href: "/apps", label: "Apps" }, { href: "/#realisations", label: "Work" }, { href: "/#tarifs", label: "Pricing" }, { href: "/#contact", label: "Contact" }],
    space: "My space", demo: "See the demo", login: "Log in", signup: ["Create my account", "Sign up"],
    tagline: "Websites, apps and business software, built to measure. Based in Belgium, working worldwide.",
    cols: [
      { title: "Custom work", links: [{ href: "/sur-mesure/creation-site-internet", label: "Website design" }, { href: "/sur-mesure/refonte-site-internet", label: "Website redesign" }, { href: "/sur-mesure/boutique-en-ligne", label: "Online store" }, { href: "/sur-mesure/application-web-saas", label: "Web apps & SaaS" }, { href: "/sur-mesure/application-mobile", label: "Mobile app" }, { href: "/sur-mesure/automatisation-bots", label: "Automation & AI" }] },
      { title: "Apps", links: [{ href: "/apps", label: "All apps" }, { href: "/logiciel/garage", label: "Software for garages" }, { href: "/logiciel/kine", label: "Software for physios" }] },
      { title: "Skydev", links: [{ href: "/sur-mesure", label: "Custom work" }, { href: "/#tarifs", label: "Pricing" }, { href: "/connexion", label: "Log in" }, { href: "/conditions-utilisation", label: "Terms (French)" }, { href: "/confidentialite", label: "Privacy (French)" }] },
    ],
    contact: "Contact", place: "Wavre, Belgium", legal: "sole proprietorship", lang: "Français", langLabel: "Voir cette page en français",
  },
};

/** Cadre des pages publiques sur les adresses Skydev : en-tête flottant, pied de page, styles .sky, en français ou en anglais. */
export function SkydevChrome({ signedIn, children, locale = "fr", path = "/" }: { signedIn: boolean; children: ReactNode; locale?: SiteLocale; path?: string }) {
  const t = T[locale];
  const L = (href: string) => alternatePath(href, locale);
  // Même page dans l'autre langue (les pages sans version anglaise — annuaire, blog… — renvoient vers l'accueil anglais).
  const other: SiteLocale = locale === "en" ? "fr" : "en";
  const alt = alternatePath(path, other);
  const switchHref = other === "en" && !alt.startsWith("/en") ? "/en" : alt;
  return (
    <div className="sky" lang={locale}>
      <LocaleGuard locale={locale} />
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">{t.skip}</a>
      {!signedIn ? (
        <p className="promo-bar"><b>{t.promo[0]}</b>{t.promo[1]}<Link href={L("/inscription")}>{t.tryIt}</Link></p>
      ) : null}
      <header>
        <div className="nav">
          <Link href={L("/")} className="brand" aria-label={t.home}>
            <BrandMark brand="skydev" className="size-[30px]" />
            skydev
          </Link>
          <nav className="navlinks" aria-label={t.mainNav}>
            {t.nav.map((n) => <Link key={n.href} href={L(n.href)}>{n.label}</Link>)}
          </nav>
          <div className="nav-r">
            <a className="nav-login nav-lang" href={switchHref} hrefLang={other} aria-label={t.langLabel}>{other.toUpperCase()}</a>
            {signedIn ? (
              <Link className="btn btn-primary btn-sm" href="/app">{t.space}</Link>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- route qui ouvre une session : vraie navigation */}
                {locale === "fr" ? <a className="nav-login nav-demo" href="/demo">{t.demo}</a> : null}
                <Link className="nav-login nav-signin" href={L("/connexion")}>{t.login}</Link>
                <Link className="btn btn-primary btn-sm" href={L("/inscription")}><span className="lg-only">{t.signup[0]}</span><span className="sm-only">{t.signup[1]}</span></Link>
              </>
            )}
            <details className="mnav">
              <summary aria-label="Menu"><Menu className="ico" aria-hidden="true" /></summary>
              <nav className="mnav-panel" aria-label={t.mobileNav}>
                {t.nav.map((n) => <Link key={n.href} href={L(n.href)}>{n.label}</Link>)}
                {!signedIn ? <Link href={L("/connexion")}>{t.login}</Link> : null}
                <a href={switchHref} hrefLang={other}>{t.lang}</a>
              </nav>
            </details>
          </div>
        </div>
      </header>
      <main id="contenu">{children}</main>
      <footer>
        <div className="wrap foot">
          <div>
            <span className="brand"><BrandMark brand="skydev" className="size-[30px]" />skydev</span>
            <p className="muted" style={{ fontSize: 14, maxWidth: 300, margin: "12px 0 0" }}>{t.tagline}</p>
          </div>
          {t.cols.map((c) => (
            <div key={c.title}>
              <h4>{c.title}</h4>
              <ul>{c.links.map((x) => <li key={x.href}><Link href={L(x.href)}>{x.label}</Link></li>)}</ul>
            </div>
          ))}
          <div>
            <h4>{t.contact}</h4>
            <ul><li><a href="tel:+32477443988">{locale === "en" ? "+32 477 44 39 88" : "0477 44 39 88"}</a></li><li><a href="mailto:info@skydev.be">info@skydev.be</a></li><li>{t.place}</li><li><a href={switchHref} hrefLang={other}>{t.lang}</a></li></ul>
          </div>
        </div>
        <div className="wrap legal">© {new Date().getFullYear()} Skydev — {LEGAL.owner}, {t.legal} · {legalAddress} · BCE {LEGAL.bce} · TVA {LEGAL.vat}</div>
      </footer>
    </div>
  );
}
