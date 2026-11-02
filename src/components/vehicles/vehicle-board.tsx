"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CarFront, ExternalLink, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { VEHICLE_STATUS, formatKm, formatPrice, formatRegistration, vehicleFullTitle, type VehicleStatus } from "@/lib/vehicles";
import { setVehicleStatus } from "@/server/actions/vehicles";

export type BoardVehicle = { id: string; slug: string; status: string; make: string; model: string; version: string | null; priceCents: number | null; mileageKm: number | null; firstRegistration: string | null; photo: string | null };

const FILTERS: { key: "all" | VehicleStatus; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "for_sale", label: "En vente" },
  { key: "reserved", label: "Réservés" },
  { key: "draft", label: "Brouillons" },
  { key: "sold", label: "Vendus" },
];

/** Liste des véhicules : filtres par statut, recherche, statut modifiable en un clic. */
export function VehicleBoard({ vehicles, canManage, publicBase }: { vehicles: BoardVehicle[]; canManage: boolean; publicBase: string }) {
  const [filter, setFilter] = useState<"all" | VehicleStatus>("all");
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, f.key === "all" ? vehicles.length : vehicles.filter((v) => v.status === f.key).length])), [vehicles]);
  const shown = vehicles.filter((v) => (filter === "all" || v.status === filter) && (!q.trim() || vehicleFullTitle(v).toLowerCase().includes(q.trim().toLowerCase())));

  if (!vehicles.length)
    return (
      <div className="rounded-2xl border border-border bg-surface">
        <EmptyState
          icon={<CarFront />}
          title="Aucun véhicule pour l'instant"
          description="Ajoutez votre premier véhicule : marque, modèle, kilométrage, prix, options et photos. Il apparaîtra dans votre vitrine en ligne dès qu'il sera « En vente »."
          action={canManage ? <ButtonLink href="/app/vehicules/nouveau" icon={<Plus className="size-4" aria-hidden="true" />}>Ajouter un véhicule</ButtonLink> : undefined}
        />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Filtrer par statut">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap transition-colors duration-150", filter === f.key ? "border-accent bg-accent-soft font-medium text-accent-soft-foreground" : "border-border text-muted hover:text-text")}>
              {f.label}<span className="tabular-nums opacity-70">{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <label className="relative sm:ml-auto sm:w-64">
          <span className="sr-only">Rechercher un véhicule</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Marque, modèle…" className="h-9 w-full rounded-lg border border-border-strong bg-surface pr-3 pl-9 text-sm focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/30" />
        </label>
      </div>
      {err ? <p className="text-sm text-danger" role="alert">{err}</p> : null}
      {shown.length ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((v) => {
            const st = VEHICLE_STATUS[v.status as VehicleStatus] ?? VEHICLE_STATUS.draft;
            return (
              <li key={v.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
                <Link href={`/app/vehicules/${v.id}`} className="group block">
                  <div className="relative aspect-[4/3] bg-surface-muted">
                    {v.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- photos téléversées (/media)
                      <img src={v.photo} alt="" className="size-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted"><CarFront className="size-10" aria-hidden="true" /></div>
                    )}
                    <span className="absolute top-3 left-3"><Badge tone={st.tone}>{st.label}</Badge></span>
                  </div>
                  <div className="p-4">
                    <p className="truncate font-semibold group-hover:text-accent">{vehicleFullTitle(v)}</p>
                    <p className="mt-0.5 text-sm text-muted">{[formatRegistration(v.firstRegistration), formatKm(v.mileageKm)].filter(Boolean).join(" · ") || "Fiche à compléter"}</p>
                    <p className="mt-2 text-lg font-semibold tabular-nums">{formatPrice(v.priceCents)}</p>
                  </div>
                </Link>
                <div className="mt-auto flex items-center gap-2 border-t border-border px-4 py-2.5">
                  {canManage ? (
                    <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                      <span className="sr-only">Statut de {vehicleFullTitle(v)}</span>
                      <select
                        value={v.status}
                        disabled={pending}
                        onChange={(e) => start(async () => { setErr(null); const r = await setVehicleStatus(v.id, e.target.value); if (!r.ok) setErr(r.error); })}
                        className="h-8 min-w-0 flex-1 rounded-lg border border-border-strong bg-surface px-2 text-sm"
                      >
                        {Object.entries(VEHICLE_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                      </select>
                    </label>
                  ) : <span className="flex-1" />}
                  {st.public ? (
                    <a href={`${publicBase}/${v.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label={`Voir la fiche publique de ${vehicleFullTitle(v)}`} title="Voir la fiche publique">
                      <ExternalLink className="size-4" aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted">Aucun véhicule ne correspond.</p>
      )}
    </div>
  );
}
