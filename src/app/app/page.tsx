import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TodayPage } from "@/components/app/today";
import { AppLauncher } from "@/components/apps/app-launcher";
import { PageHeader } from "@/components/ui/page-header";
import { currentBrand } from "@/server/brand";
import { requireContext } from "@/server/context";

export async function generateMetadata(): Promise<Metadata> {
  // Le modèle « %s · Marque » du layout ne s'applique pas à la page du même dossier : titre complet ici.
  const brand = await currentBrand();
  return { title: { absolute: `${brand.id === "skydev" ? "Accueil" : "Aujourd'hui"} · ${brand.name}` } };
}

/** Branshee : l'accueil reste « Aujourd'hui » (app RDV). Skydev : l'accueil est le lanceur de toutes les apps. */
export default async function Page({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const brand = await currentBrand();
  if (brand.id !== "skydev") return TodayPage({ searchParams });
  if ((await searchParams).bienvenue) redirect("/app/rdv?bienvenue=1");
  const ctx = await requireContext();
  const firstName = ctx.user.name.split(" ")[0];
  return (
    <>
      <PageHeader title={`Bonjour ${firstName}`} description={`Toutes les apps de ${ctx.business.name}, au même endroit.`} />
      <AppLauncher />
    </>
  );
}
