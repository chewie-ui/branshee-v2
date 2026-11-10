import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { Track } from "@/components/site/track";
import { getSessionUser } from "@/server/auth/session";
import { SkydevChrome } from "@/components/skydev/chrome";
import { currentBrand } from "@/server/brand";
import { headers } from "next/headers";
import { localeOfPath } from "@/lib/site-locale";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const session = await getSessionUser();
  // Adresses Skydev : en-tête et pied de page Skydev (connexion, inscription), même contenu derrière.
  if ((await currentBrand()).id === "skydev") {
    const path = (await headers()).get("x-pathname") ?? "/";
    return (
      <SkydevChrome signedIn={!!session} locale={localeOfPath(path)} path={path}>
        {children}
        <Track />
      </SkydevChrome>
    );
  }
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
