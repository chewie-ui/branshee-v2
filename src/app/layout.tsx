import type { Metadata } from "next";
import "./globals.css";
import { isStaging } from "@/lib/staging";

const base = (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(base),
  title: { default: "Branshee", template: "%s · Branshee" },
  description: "La prise de rendez-vous en ligne, simple, pour les indépendants et les petites équipes.",
  openGraph: { type: "website", siteName: "Branshee", locale: "fr_BE" },
  twitter: { card: "summary_large_image" },
};

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
