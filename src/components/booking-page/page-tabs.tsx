import { Tabs } from "@/components/ui/tabs";
import { appT } from "@/server/app-locale";

export async function PageTabs() {
  const t = await appT();
  return (
    <Tabs
      items={[
        { href: "/app/page-de-reservation", label: "Contenu" },
        { href: "/app/page-de-reservation/apparence", label: "Apparence" },
        { href: "/app/page-de-reservation/partager", label: t("Partager et intégrer") },
        { href: "/app/page-de-reservation/avis", label: t("Avis") },
      ]}
    />
  );
}
