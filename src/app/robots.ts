import type { MetadataRoute } from "next";
import { siteUrl } from "@/server/site";
import { isStaging } from "@/lib/staging";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (isStaging()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/admin", "/api", "/espace-client", "/r/", "/connexion", "/inscription", "/bienvenue", "/acces/", "/auth/", "/ical/"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
