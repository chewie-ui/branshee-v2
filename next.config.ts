import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ne pas générer AGENTS.md / CLAUDE.md à chaque `next dev`.
  agentRules: false,
  experimental: {
    // Envoi de PDF (dossiers clients) et d'images : 10 Mo maximum, plus la marge du multipart.
    serverActions: { bodySizeLimit: "11mb" },
  },
  // L'espace pro, l'admin et la connexion ne doivent jamais être affichés dans le cadre d'un autre site
  // (clickjacking). Les pages publiques de réservation, elles, sont faites pour être intégrées.
  async headers() {
    const noFrame = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
    ];
    return ["/app/:path*", "/admin/:path*", "/connexion", "/inscription", "/mot-de-passe-oublie/:path*", "/bienvenue"].map((source) => ({ source, headers: noFrame }));
  },
};

export default nextConfig;
