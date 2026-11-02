import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { DeleteVehicle } from "@/components/vehicles/delete-vehicle";
import { VehicleForm, type VehicleFormValues } from "@/components/vehicles/vehicle-form";
import { VehiclePhotos } from "@/components/vehicles/vehicle-photos";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { VEHICLE_STATUS, vehicleFullTitle, type VehicleStatus } from "@/lib/vehicles";
import { requireContext } from "@/server/context";
import { vehicleOf, vehicleRights } from "@/server/vehicles";

export const metadata: Metadata = { title: "Véhicule" };

const s = (n: number | null) => (n == null ? "" : String(n));
const euros = (c: number | null) => (c == null ? "" : String(c % 100 ? (c / 100).toFixed(2).replace(".", ",") : c / 100));

export default async function VehiclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ photos?: string }> }) {
  const ctx = await requireContext(undefined, { app: "vehicules" });
  const v = await vehicleOf(ctx.business.id, (await params).id);
  if (!v) notFound();
  const rights = vehicleRights(ctx);
  const st = VEHICLE_STATUS[v.status as VehicleStatus] ?? VEHICLE_STATUS.draft;
  const initial: VehicleFormValues = {
    status: v.status, make: v.make, model: v.model, version: v.version ?? "", bodyType: v.bodyType ?? "", fuel: v.fuel ?? "", gearbox: v.gearbox ?? "", firstRegistration: v.firstRegistration ?? "",
    mileageKm: s(v.mileageKm), powerKw: s(v.powerKw), engineCc: s(v.engineCc), co2: s(v.co2), euroNorm: v.euroNorm ?? "", color: v.color ?? "", interior: v.interior ?? "", doors: s(v.doors), seats: s(v.seats), owners: s(v.owners),
    price: euros(v.priceCents), vatMode: v.vatMode, warrantyMonths: s(v.warrantyMonths), carPass: v.carPass, serviceHistory: v.serviceHistory, equipment: v.equipment, description: v.description ?? "",
    vin: rights.manage ? (v.vin ?? "") : "", plate: rights.manage ? (v.plate ?? "") : "", purchase: rights.manage ? euros(v.purchaseCents) : "", internalNote: v.internalNote ?? "",
  };
  const publicUrl = `/vehicules/${ctx.business.slug}/${v.slug}`;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/app/vehicules" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text"><ArrowLeft className="size-4" aria-hidden="true" />Véhicules</Link>
        <PageHeader
          title={vehicleFullTitle(v)}
          description={st.public ? "Visible dans votre vitrine en ligne." : v.status === "sold" ? "Vendu : retiré de la vitrine." : "Brouillon : pas encore visible en ligne."}
          action={<div className="flex items-center gap-2"><Badge tone={st.tone}>{st.label}</Badge>{st.public || v.status === "sold" ? <ButtonLink href={publicUrl} target="_blank" rel="noopener noreferrer" variant="secondary" icon={<ExternalLink className="size-4" aria-hidden="true" />}>Fiche publique</ButtonLink> : null}</div>}
        />
      </div>
      <VehiclePhotos id={v.id} photos={v.photos} canManage={rights.manage} highlight={(await searchParams).photos === "1" && !v.photos.length} />
      {rights.manage ? <VehicleForm id={v.id} initial={initial} /> : <p className="text-sm text-muted">Seul le responsable peut modifier cette fiche.</p>}
      {rights.manage ? <DeleteVehicle id={v.id} title={vehicleFullTitle(v)} /> : null}
    </div>
  );
}
