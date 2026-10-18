import type { MetadataRoute } from "next";
import { siteUrl } from "@/server/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/admin", "/api", "/espace-client", "/r/", "/connexion", "/inscription", "/bienvenue", "/acces/", "/auth/", "/ical/"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
