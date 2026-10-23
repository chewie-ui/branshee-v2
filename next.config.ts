import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Ne pas générer AGENTS.md / CLAUDE.md à chaque `next dev`.
  agentRules: false,
  experimental: {
    // Envoi de PDF (dossiers clients) et d'images : 10 Mo maximum, plus la marge du multipart.
    serverActions: { bodySizeLimit: "11mb" },
  },
  // L'espace pro, l'admin et la connexion ne doivent jamais être affichés dans le cadre d'un autre site
  // (clickjacking). Les pages publiques de réservation, elles, sont faites pour être intégrées.
  // Anciennes adresses de Branshee (liens partagés, favoris, Google) → nouvelles pages.
  async redirects() {
    const map: [string, string][] = [
      ["/login", "/connexion"],
      ["/register", "/inscription"],
      ["/s-inscrire", "/inscription"],
      ["/client-login", "/connexion"],
      ["/client-register", "/inscription?client=1"],
      ["/forgot-password", "/mot-de-passe-oublie"],
      ["/pro", "/"],
      ["/manage-business", "/"],
      ["/welcome", "/bienvenue"],
      ["/demarrer", "/bienvenue"],
      ["/panel", "/app"],
      ["/appointment", "/app/agenda"],
      ["/subscription", "/app/reglages/abonnement"],
      ["/parrainage", "/app/reglages/abonnement"],
      ["/support", "/app/aide"],
      ["/superadmin", "/admin"],
      ["/conditions", "/conditions-utilisation"],
      ["/cgu", "/conditions-utilisation"],
      ["/privacy", "/confidentialite"],
      // Autres adresses de l'ancien Branshee (favoris des pros, liens de l'app mobile, emails déjà envoyés).
      ["/settings", "/app/reglages"],
      ["/client", "/espace-client"],
      ["/client/login", "/connexion"],
      ["/client/register", "/inscription?client=1"],
      ["/history", "/app/historique"],
      ["/appointement/:id", "/app/agenda"],
      ["/clients-hub", "/app/clients"],
      ["/clients-hub/:id", "/app/clients"],
      ["/employees", "/app/equipe"],
      ["/availability", "/app/horaires"],
      ["/demandes", "/app/demandes"],
      ["/etablissement/mes-etablissements", "/app/etablissements"],
      ["/customize-calendar", "/app/page-de-reservation"],
      ["/forms", "/app/prestations/questions"],
      ["/group-sessions", "/app/prestations"],
      ["/dashboard", "/app"],
    ];
    return map.map(([source, destination]) => ({ source, destination, permanent: true }));
  },
  async headers() {
    const noFrame = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
    ];
    // En-têtes de sécurité sur tout le site (les pages de réservation restent intégrables sur le site des pros).
    const everywhere = [
      { key: "Strict-Transport-Security", value: "max-age=31536000" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
    ];
    return [
      { source: "/:path*", headers: everywhere },
      ...["/app/:path*", "/admin/:path*", "/connexion", "/inscription", "/mot-de-passe-oublie/:path*", "/bienvenue", "/espace-client/:path*", "/espace-client"].map((source) => ({ source, headers: noFrame })),
    ];
  },
};

export default nextConfig;
