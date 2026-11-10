import type { Metadata } from "next";
import { ExternalLink, Plus } from "lucide-react";
import { VehicleBoard } from "@/components/vehicles/vehicle-board";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { vehicleRights, vehiclesOf } from "@/server/vehicles";
import { appMetadata } from "@/server/app-locale";

export const generateMetadata = appMetadata("Véhicules");

export default async function VehiclesPage() {
  const ctx = await requireContext(undefined, { app: "vehicules" });
  const rights = vehicleRights(ctx);
  const list = await vehiclesOf(ctx.business.id);
  const publicBase = `/vehicules/${ctx.business.slug}`;
  return (
    <>
      <PageHeader
        title="Véhicules"
        description="Vos voitures en vente : fiche complète, photos et vitrine en ligne."
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={publicBase} target="_blank" rel="noopener noreferrer" variant="secondary" icon={<ExternalLink className="size-4" aria-hidden="true" />}>Voir ma vitrine</ButtonLink>
            {rights.manage ? <ButtonLink href="/app/vehicules/nouveau" icon={<Plus className="size-4" aria-hidden="true" />}>Ajouter un véhicule</ButtonLink> : null}
          </div>
        }
      />
      <VehicleBoard
        canManage={rights.manage}
        publicBase={publicBase}
        vehicles={list.map((v) => ({ id: v.id, slug: v.slug, status: v.status, make: v.make, model: v.model, version: v.version, priceCents: v.priceCents, mileageKm: v.mileageKm, firstRegistration: v.firstRegistration, photo: v.photos[0] ?? null }))}
      />
    </>
  );
}
