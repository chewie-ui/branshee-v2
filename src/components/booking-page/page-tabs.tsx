import { Tabs } from "@/components/ui/tabs";

export function PageTabs() {
  return (
    <Tabs
      items={[
        { href: "/app/page-de-reservation", label: "Contenu" },
        { href: "/app/page-de-reservation/apparence", label: "Apparence" },
        { href: "/app/page-de-reservation/partager", label: "Partager et intégrer" },
        { href: "/app/page-de-reservation/avis", label: "Avis" },
      ]}
    />
  );
}
