import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Track } from "@/components/site/track";
import { getSessionUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const session = await getSessionUser();
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">Aller au contenu</a>
      <SiteHeader signedIn={!!session} />
      <main id="contenu" className="flex-1">{children}</main>
      <SiteFooter />
      <Track />
    </div>
  );
}
