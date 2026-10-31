import type { MetadataRoute } from "next";
import { currentBrand } from "@/server/brand";

/** Installation comme application (téléphone, ordinateur) : ouvre directement l'espace pro. Nom et icônes selon la marque. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const sky = (await currentBrand()).id === "skydev";
  return {
    name: sky ? "skydev" : "Branshee",
    short_name: sky ? "skydev" : "Branshee",
    description: sky ? "Toutes les apps de votre entreprise : rendez-vous, factures, caisse, site web." : "Agenda et réservation en ligne pour les professionnels.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f6f6f7",
    theme_color: sky ? "#1e1b4b" : "#4f46e5",
    lang: "fr",
    icons: sky
      ? [
          { src: "/skydev-icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/skydev-icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/skydev-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ]
      : [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
  };
}
