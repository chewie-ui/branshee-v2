import type { MetadataRoute } from "next";

/** Installation comme application (téléphone, ordinateur) : ouvre directement l'espace pro. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Branshee",
    short_name: "Branshee",
    description: "Agenda et réservation en ligne pour les professionnels.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f6f6f7",
    theme_color: "#4f46e5",
    lang: "fr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
