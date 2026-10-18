import type { Metadata } from "next";
import { FeatureRow, NavToggle } from "@/components/admin/platform";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { APP_FEATURES, HIDDEN_FEATURES, PAGE_FEATURES, navKey } from "@/lib/features";
import { NAV_FOOTER, NAV_GROUPS } from "@/lib/navigation";
import { requireSuperadmin } from "@/server/admin";
import { getFlags, invalidateFlags } from "@/server/features";

export const metadata: Metadata = { title: "Fonctionnalités" };

export default async function AdminFeatures() {
  await requireSuperadmin();
  invalidateFlags();
  const flags = await getFlags();
  const nav = [...NAV_GROUPS.flatMap((g) => g.items), ...NAV_FOOTER].filter((i) => i.href !== "/app");
  return (
    <>
      <PageHeader title="Fonctionnalités" description="Mettre une page en maintenance, couper une fonctionnalité ou masquer un lien du menu, sans redéployer." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Pages" description="Hors « En ligne », les visiteurs voient une page d'information à la place (le super-admin garde l'accès à l'espace pro)." />
          <ul className="divide-y divide-border">
            {PAGE_FEATURES.map((f) => <FeatureRow key={f.key} k={f.key} label={f.label} status={flags.get(f.key)?.status ?? "active"} message={flags.get(f.key)?.message ?? ""} />)}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Fonctionnalités de l'espace pro" />
          <ul className="divide-y divide-border">
            {APP_FEATURES.map((f) => <FeatureRow key={f.key} k={f.key} label={f.label} status={flags.get(f.key)?.status ?? "active"} message="" simple />)}
            {HIDDEN_FEATURES.map((f) => <FeatureRow key={f.key} k={f.key} label={f.label} status={flags.get(f.key)?.status ?? "disabled"} message="" simple />)}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Menu de l'espace pro" description="Un lien masqué disparaît du menu pour tous les pros (la page reste accessible par son adresse)." />
          <div className="divide-y divide-border">
            {nav.map((i) => <NavToggle key={i.href} href={i.href} label={i.label} hidden={!!flags.get(navKey(i.href))?.hiddenInNav} />)}
          </div>
        </Card>
      </div>
    </>
  );
}
