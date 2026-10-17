import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ne pas générer AGENTS.md / CLAUDE.md à chaque `next dev`.
  agentRules: false,
  experimental: {
    // Envoi de PDF (dossiers clients) et d'images : 10 Mo maximum, plus la marge du multipart.
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default nextConfig;
