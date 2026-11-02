import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CarFront, SlidersHorizontal } from "lucide-react";
import { PublicVehicleCard } from "@/components/vehicles/public-card";
import { VehicleShell } from "@/components/vehicles/public-shell";
import { FUELS, GEARBOXES } from "@/lib/vehicles";
import { publicVehicles, type VehicleFilters } from "@/server/vehicles";

export const dynamic = "force-dynamic";

type P = Promise<{ slug: string }>;
type SP = Promise<{ marque?: string; carburant?: string; boite?: string; prix?: string; km?: string; tri?: string }>;

function filters(sp: Awaited<SP>): VehicleFilters {
  const n = (s?: string) => (s && /^\d{1,9}$/.test(s) ? Number(s) : undefined);
  return {
    make: sp.marque?.slice(0, 40) || undefined,
    fuel: sp.carburant && sp.carburant in FUELS ? sp.carburant : undefined,
    gearbox: sp.boite && sp.boite in GEARBOXES ? sp.boite : undefined,
    maxPrice: n(sp.prix),
    maxKm: n(sp.km),
    sort: sp.tri === "prix-croissant" ? "price-asc" : sp.tri === "prix-decroissant" ? "price-desc" : sp.tri === "km" ? "km-asc" : "recent",
  };
}

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return {};
  const d = await publicVehicles(slug);
  if (!d) return {};
  const n = d.vehicles.length;
  return {
    title: { absolute: `Véhicules d'occasion · ${d.business.name}${d.business.city ? ` à ${d.business.city}` : ""}` },
    description: `${n ? `${n} véhicule${n > 1 ? "s" : ""} en vente` : "Nos véhicules"} chez ${d.business.name}${d.business.city ? ` (${d.business.city})` : ""} : photos, kilométrage, options et prix. Contactez-nous pour un essai.`,
    alternates: { canonical: `/vehicules/${slug}` },
    robots: n ? undefined : { index: false, follow: true },
  };
}

/** Vitrine publique des véhicules d'un garage : filtres simples (formulaire GET), cartes avec photo et prix. */
export default async function VehicleShowroom({ params, searchParams }: { params: P; searchParams: SP }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound();
  const sp = await searchParams;
  const f = filters(sp);
  const d = await publicVehicles(slug, f);
  if (!d) notFound();
  const all = await publicVehicles(slug);
  const filtered = !!(f.make || f.fuel || f.gearbox || f.maxPrice || f.maxKm);
  const base = `/vehicules/${slug}`;
  const sel = "h-10 rounded-lg border border-border-strong bg-surface px-3 text-sm";
  return (
    <VehicleShell business={d.business}>
      <h1 className="text-3xl font-semibold tracking-tight text-balance">Nos véhicules</h1>
      <p className="mt-1 text-muted">{all?.vehicles.length ? `${all.vehicles.length} véhicule${all.vehicles.length > 1 ? "s" : ""} disponible${all.vehicles.length > 1 ? "s" : ""}` : "Aucun véhicule en vente pour le moment."}</p>

      {all?.vehicles.length ? (
        <form action={base} className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4" aria-label="Filtrer les véhicules">
          <SlidersHorizontal className="mb-2.5 hidden size-4 text-muted sm:block" aria-hidden="true" />
          <label className="flex flex-col gap-1 text-xs text-muted">Marque
            <select name="marque" defaultValue={f.make ?? ""} className={sel}><option value="">Toutes</option>{d.makes.map((m) => <option key={m} value={m}>{m}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">Carburant
            <select name="carburant" defaultValue={f.fuel ?? ""} className={sel}><option value="">Tous</option>{Object.entries(FUELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">Boîte
            <select name="boite" defaultValue={f.gearbox ?? ""} className={sel}><option value="">Toutes</option>{Object.entries(GEARBOXES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">Prix max (€)
            <input name="prix" inputMode="numeric" defaultValue={f.maxPrice ?? ""} placeholder="20000" className={`${sel} w-28`} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">Km max
            <input name="km" inputMode="numeric" defaultValue={f.maxKm ?? ""} placeholder="100000" className={`${sel} w-28`} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">Trier
            <select name="tri" defaultValue={sp.tri ?? ""} className={sel}><option value="">Plus récents</option><option value="prix-croissant">Prix croissant</option><option value="prix-decroissant">Prix décroissant</option><option value="km">Kilométrage</option></select>
          </label>
          <button type="submit" className="h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-hover">Voir</button>
          {filtered ? <Link href={base} className="h-10 px-2 text-sm leading-10 text-muted hover:text-text">Effacer</Link> : null}
        </form>
      ) : null}

      {d.vehicles.length ? (
        <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {d.vehicles.map((v) => <li key={v.id}><PublicVehicleCard v={v} base={base} /></li>)}
        </ul>
      ) : (
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-border bg-surface px-6 py-14 text-center">
          <CarFront className="size-10 text-muted" aria-hidden="true" />
          <p className="mt-3 font-medium">{filtered ? "Aucun véhicule ne correspond à ces critères." : "Revenez bientôt : de nouveaux véhicules arrivent."}</p>
          {d.business.phone ? <p className="mt-1 text-sm text-muted">Vous cherchez un modèle précis ? Appelez-nous au {d.business.phone}.</p> : null}
        </div>
      )}
    </VehicleShell>
  );
}
