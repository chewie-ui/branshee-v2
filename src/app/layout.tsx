import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Branshee", template: "%s · Branshee" },
  description: "La prise de rendez-vous en ligne, simple, pour les indépendants et les petites équipes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
