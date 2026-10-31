import type { Metadata } from "next";
import "./globals.css";
import { isStaging } from "@/lib/staging";
import { currentBrand } from "@/server/brand";

const base = (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");

/** Métadonnées de base selon la marque de l'adresse visitée (nom, icône d'onglet). */
export async function generateMetadata(): Promise<Metadata> {
  const sky = (await currentBrand()).id === "skydev";
  const name = sky ? "Skydev" : "Branshee";
  return {
    metadataBase: new URL(base),
    title: { default: name, template: `%s · ${name}` },
    description: sky ? "Toutes les apps de votre entreprise : rendez-vous, factures, site web, équipe." : "La prise de rendez-vous en ligne, simple, pour les indépendants et les petites équipes.",
    openGraph: { type: "website", siteName: name, locale: "fr_BE" },
    twitter: { card: "summary_large_image" },
    icons: sky
      ? { icon: [{ url: "/skydev-icon.svg", type: "image/svg+xml" }, { url: "/skydev-icon-192.png", sizes: "192x192", type: "image/png" }], apple: [{ url: "/skydev-apple-icon.png", sizes: "180x180" }] }
      : { icon: [{ url: "/favicon.ico" }], apple: [{ url: "/apple-icon.png" }] },
    // Google Search Console : code de la balise « google-site-verification » (sans la balise), dans l'environnement.
    verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-dvh antialiased">
        {isStaging() ? (
          <div role="status" className="bg-warning-soft px-4 py-1.5 text-center text-xs font-medium text-warning">
            Version de test — les emails, SMS et notifications ne partent pas vers les clients.
          </div>
        ) : null}
        {children}
      </body>
    </html>
  );
}
