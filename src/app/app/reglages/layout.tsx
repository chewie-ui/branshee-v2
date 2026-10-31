import type { ReactNode } from "react";
import { currentBrand } from "@/server/brand";
import { requireContext } from "@/server/context";
import { assistantAllowed } from "@/server/assistant";
import { SettingsNav } from "@/components/settings/settings-nav";
import { PageHeader } from "@/components/ui/page-header";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const [ctx, brand] = await Promise.all([requireContext(), currentBrand()]);
  // Section « Assistant IA » : Skydev seulement, hors métiers de santé, pour le responsable.
  const manager = ctx.member.isOwner || ctx.can("settings.manage");
  const extra = [
    ...(brand.id === "skydev" && manager ? [{ href: "/app/reglages/site-connecte", label: "Connecter un site" }] : []),
    ...(brand.id === "skydev" && (await assistantAllowed(ctx)) && manager ? [{ href: "/app/reglages/assistant", label: "Assistant IA" }] : []),
  ];
  return (
    <>
      <PageHeader title="Réglages" description="Tout ce qu'on règle une fois, rangé par thème." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <SettingsNav extra={extra} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}
