import Link from "next/link";
import { CarFront } from "lucide-react";
import { FUELS, GEARBOXES, formatKm, formatPrice, registrationYear, vehicleFullTitle } from "@/lib/vehicles";
import type { PublicVehicle } from "@/server/vehicles";

/** Carte d'un véhicule dans la vitrine publique. */
export function PublicVehicleCard({ v, base }: { v: PublicVehicle; base: string }) {
  const facts = [registrationYear(v.firstRegistration), formatKm(v.mileageKm), v.fuel ? (FUELS as Record<string, string>)[v.fuel] : null, v.gearbox ? (GEARBOXES as Record<string, string>)[v.gearbox] : null].filter(Boolean);
  return (
    <Link href={`${base}/${v.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-shadow duration-150 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      <div className="relative aspect-[4/3] bg-surface-muted">
        {v.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- photos téléversées (/media)
          <img src={v.photos[0]} alt={vehicleFullTitle(v)} className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted"><CarFront className="size-10" aria-hidden="true" /></div>
        )}
        {v.status === "reserved" ? <span className="absolute top-3 left-3 rounded-md bg-warning px-2 py-0.5 text-xs font-semibold text-white">Réservé</span> : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h2 className="font-semibold group-hover:underline">{vehicleFullTitle(v)}</h2>
        <p className="mt-1 text-sm text-muted">{facts.join(" · ")}</p>
        <p className="mt-auto pt-3 text-xl font-semibold tabular-nums">{formatPrice(v.priceCents)}</p>
      </div>
    </Link>
  );
}
