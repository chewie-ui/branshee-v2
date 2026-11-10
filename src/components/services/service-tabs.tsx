import { Tabs } from "@/components/ui/tabs";
import { appT } from "@/server/app-locale";

export async function ServiceTabs() {
  const t = await appT();
  return (
    <Tabs
      items={[
        { href: "/app/prestations", label: t("Prestations") },
        { href: "/app/prestations/jours-et-heures", label: t("Jours et heures") },
        { href: "/app/prestations/categories", label: t("Catégories") },
        { href: "/app/prestations/questions", label: t("Questions avant réservation") },
      ]}
    />
  );
}
