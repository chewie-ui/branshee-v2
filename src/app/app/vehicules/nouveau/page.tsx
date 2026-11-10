import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EMPTY_VEHICLE, VehicleForm } from "@/components/vehicles/vehicle-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { redirect } from "next/navigation";
import { vehicleRights } from "@/server/vehicles";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Nouveau véhicule");

export default async function NewVehiclePage() {
  const t = await appT();
  const ctx = await requireContext(undefined, { app: "vehicules" });
  if (!vehicleRights(ctx).manage) redirect("/app/vehicules");
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/app/vehicules" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text"><ArrowLeft className="size-4" aria-hidden="true" />{t("Véhicules")}</Link>
      <PageHeader title={t("Nouveau véhicule")} description="Remplissez l'essentiel ; vous ajouterez les photos juste après." />
      <VehicleForm id={null} initial={EMPTY_VEHICLE} />
    </div>
  );
}
