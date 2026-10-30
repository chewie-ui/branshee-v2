import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { LEGAL, legalAddress } from "@/lib/legal";
import "./skydev.css";

/** Cadre des pages publiques sur les adresses Skydev : en-tête flottant, pied de page, styles .sky. */
export function SkydevChrome({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  return (
    <div className="sky">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">Aller au contenu</a>
      <header>
        <div className="nav">
          <Link href="/" className="brand" aria-label="Skydev, accueil">
            <BrandMark brand="skydev" className="size-[30px]" />
            Skydev
          </Link>
          <nav className="navlinks" aria-label="Navigation principale">
            <Link href="/#apps">Apps</Link>
            <Link href="/#sur-mesure">Sur mesure</Link>
            <Link href="/#realisations">Réalisations</Link>
            <Link href="/#tarifs">Tarifs</Link>
            <Link href="/annuaire">Trouver un pro</Link>
          </nav>
          <div className="nav-r">
            {signedIn ? (
              <Link className="btn btn-primary btn-sm" href="/app">Mon espace</Link>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- route qui ouvre une session : vraie navigation */}
                <a className="nav-login nav-demo" href="/demo">Voir la démo</a>
                <Link className="nav-login" href="/connexion">Se connecter</Link>
                <Link className="btn btn-primary btn-sm" href="/inscription"><span className="lg-only">Créer mon compte</span><span className="sm-only">S&apos;inscrire</span></Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="contenu">{children}</main>
      <footer>
        <div className="wrap foot">
          <div>
            <span className="brand"><BrandMark brand="skydev" className="size-[30px]" />Skydev</span>
            <p className="muted" style={{ fontSize: 14, maxWidth: 300, margin: "12px 0 0" }}>Le logiciel de votre entreprise, composé app par app. Conçu à Wavre.</p>
          </div>
          <div>
            <h4>Apps</h4>
            <ul><li><Link href="/#apps">Site web</Link></li><li><Link href="/#apps">RDV</Link></li><li><Link href="/#apps">Factures</Link></li><li><Link href="/#apps">Boutique</Link></li><li><Link href="/#apps">Tél IA</Link></li></ul>
          </div>
          <div>
            <h4>Skydev</h4>
            <ul><li><Link href="/annuaire">Trouver un professionnel</Link></li><li><Link href="/annuaire/coiffeur/wavre">Coiffeur à Wavre</Link></li><li><Link href="/annuaire/kine/wavre">Kiné à Wavre</Link></li><li><Link href="/#sur-mesure">Sur mesure</Link></li><li><Link href="/#tarifs">Tarifs</Link></li><li><Link href="/connexion">Se connecter</Link></li><li><Link href="/conditions-utilisation">Conditions</Link></li><li><Link href="/confidentialite">Confidentialité</Link></li></ul>
          </div>
          <div>
            <h4>Contact</h4>
            <ul><li><a href="tel:+32477443988">0477 44 39 88</a></li><li><a href="mailto:info@skydev.be">info@skydev.be</a></li><li>Wavre, Belgique</li></ul>
          </div>
        </div>
        <div className="wrap legal">© {new Date().getFullYear()} Skydev — {LEGAL.owner}, entreprise personne physique · {legalAddress} · BCE {LEGAL.bce} · TVA {LEGAL.vat}</div>
      </footer>
    </div>
  );
}
