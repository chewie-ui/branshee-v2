import { Tabs } from "@/components/ui/tabs";

export function ServiceTabs() {
  return (
    <Tabs
      items={[
        { href: "/app/prestations", label: "Prestations" },
        { href: "/app/prestations/categories", label: "Catégories" },
        { href: "/app/prestations/questions", label: "Questions avant réservation" },
      ]}
    />
  );
}
