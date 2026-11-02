"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { BODY_TYPES, EQUIPMENT_SUGGESTIONS, EURO_NORMS, FUELS, GEARBOXES, VEHICLE_STATUS, kwToHp } from "@/lib/vehicles";
import { saveVehicle } from "@/server/actions/vehicles";

export type VehicleFormValues = {
  status: string; make: string; model: string; version: string; bodyType: string; fuel: string; gearbox: string; firstRegistration: string;
  mileageKm: string; powerKw: string; engineCc: string; co2: string; euroNorm: string; color: string; interior: string; doors: string; seats: string; owners: string;
  price: string; vatMode: string; warrantyMonths: string; carPass: boolean; serviceHistory: boolean; equipment: string[]; description: string;
  vin: string; plate: string; purchase: string; internalNote: string;
};

export const EMPTY_VEHICLE: VehicleFormValues = {
  status: "draft", make: "", model: "", version: "", bodyType: "", fuel: "", gearbox: "", firstRegistration: "", mileageKm: "", powerKw: "", engineCc: "", co2: "", euroNorm: "",
  color: "", interior: "", doors: "", seats: "", owners: "", price: "", vatMode: "margin", warrantyMonths: "12", carPass: true, serviceHistory: false, equipment: [], description: "",
  vin: "", plate: "", purchase: "", internalNote: "",
};

/** Fiche véhicule : identité, caractéristiques, prix, équipements, description, infos internes. */
export function VehicleForm({ id, initial }: { id: string | null; initial: VehicleFormValues }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [extra, setExtra] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof VehicleFormValues>(k: K, val: VehicleFormValues[K]) => setV((o) => ({ ...o, [k]: val }));
  const txt = (k: keyof VehicleFormValues, label: string, props: React.ComponentProps<typeof Input> = {}, hint?: string) => (
    <Field label={label} htmlFor={`v-${k}`} hint={hint}>
      <Input id={`v-${k}`} value={String(v[k])} onChange={(e) => set(k, e.target.value as never)} {...props} />
    </Field>
  );
  const sel = (k: keyof VehicleFormValues, label: string, options: Record<string, string> | readonly string[]) => (
    <Field label={label} htmlFor={`v-${k}`}>
      <Select id={`v-${k}`} value={String(v[k])} onChange={(e) => set(k, e.target.value as never)}>
        <option value="">—</option>
        {Array.isArray(options) ? options.map((o) => <option key={o} value={o}>{o}</option>) : Object.entries(options).map(([val, l]) => <option key={val} value={val}>{l}</option>)}
      </Select>
    </Field>
  );
  const toggleEq = (e: string) => set("equipment", v.equipment.some((x) => x.toLowerCase() === e.toLowerCase()) ? v.equipment.filter((x) => x.toLowerCase() !== e.toLowerCase()) : [...v.equipment, e]);
  const addExtra = () => { const e = extra.trim(); if (e && !v.equipment.some((x) => x.toLowerCase() === e.toLowerCase())) set("equipment", [...v.equipment, e]); setExtra(""); };
  const hp = /^\d+$/.test(v.powerKw) ? kwToHp(Number(v.powerKw)) : null;

  const submit = () =>
    start(async () => {
      setMsg(null);
      const fd = new FormData();
      for (const [k, val] of Object.entries(v)) {
        if (k === "equipment") fd.set(k, (val as string[]).join("\n"));
        else if (typeof val === "boolean") { if (val) fd.set(k, "1"); }
        else fd.set(k, String(val));
      }
      const r = await saveVehicle(id, fd);
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      setMsg({ ok: true, text: r.message ?? "Enregistré." });
      if (!id && r.id) router.push(`/app/vehicules/${r.id}?photos=1`);
      else router.refresh();
    });

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-6">
      <Card>
        <CardHeader title="Le véhicule" description="Ce qui s'affiche en titre de l'annonce." />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {txt("make", "Marque", { required: true, placeholder: "Volkswagen", autoComplete: "off" })}
          {txt("model", "Modèle", { required: true, placeholder: "Golf", autoComplete: "off" })}
          {txt("version", "Version / finition", { placeholder: "1.5 TSI Life" })}
          {txt("firstRegistration", "1re immatriculation", { type: "month", max: `${new Date().getFullYear() + 1}-12` })}
          {txt("mileageKm", "Kilométrage", { inputMode: "numeric", placeholder: "45 000" }, "En km.")}
          {sel("fuel", "Carburant", FUELS)}
          {sel("gearbox", "Boîte de vitesses", GEARBOXES)}
          {sel("bodyType", "Carrosserie", BODY_TYPES)}
          {txt("powerKw", "Puissance (kW)", { inputMode: "numeric", placeholder: "110" }, hp ? `≈ ${hp} ch` : "Le nombre de chevaux est calculé.")}
        </div>
      </Card>

      <Card>
        <CardHeader title="Caractéristiques" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {txt("engineCc", "Cylindrée (cm³)", { inputMode: "numeric", placeholder: "1498" })}
          {txt("co2", "CO₂ (g/km)", { inputMode: "numeric", placeholder: "128" })}
          {sel("euroNorm", "Norme Euro", EURO_NORMS)}
          {txt("color", "Couleur", { placeholder: "Gris métallisé" })}
          {txt("interior", "Intérieur", { placeholder: "Tissu noir" })}
          {txt("doors", "Portes", { inputMode: "numeric", placeholder: "5" })}
          {txt("seats", "Places", { inputMode: "numeric", placeholder: "5" })}
          {txt("owners", "Propriétaires précédents", { inputMode: "numeric", placeholder: "1" })}
        </div>
      </Card>

      <Card>
        <CardHeader title="Prix et garanties" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {txt("price", "Prix TVAC (€)", { inputMode: "decimal", placeholder: "18 990" }, "Vide = « Prix sur demande ».")}
          <Field label="TVA" htmlFor="v-vatMode">
            <Select id="v-vatMode" value={v.vatMode} onChange={(e) => set("vatMode", e.target.value)}>
              <option value="margin">Régime de la marge (TVA non récupérable)</option>
              <option value="vat">TVA déductible (pour un professionnel)</option>
            </Select>
          </Field>
          {txt("warrantyMonths", "Garantie (mois)", { inputMode: "numeric", placeholder: "12" }, "Vide = sans garantie mentionnée.")}
          <label className="flex items-center gap-2.5 text-sm sm:col-span-2 lg:col-span-1">
            <input type="checkbox" checked={v.carPass} onChange={(e) => set("carPass", e.target.checked)} className="size-4 accent-[var(--accent)]" />
            Car-Pass disponible
          </label>
          <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
            <input type="checkbox" checked={v.serviceHistory} onChange={(e) => set("serviceHistory", e.target.checked)} className="size-4 accent-[var(--accent)]" />
            Carnet d&apos;entretien complet
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader title="Équipements et options" description="Cliquez pour ajouter ou retirer ; vous pouvez aussi en écrire d'autres." />
        <div className="space-y-4 p-5">
          {v.equipment.length ? (
            <ul className="flex flex-wrap gap-2" aria-label="Équipements choisis">
              {v.equipment.map((e) => (
                <li key={e}>
                  <button type="button" onClick={() => toggleEq(e)} className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground" aria-label={`Retirer ${e}`}>
                    {e}<X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {Object.entries(EQUIPMENT_SUGGESTIONS).map(([group, items]) => (
            <div key={group}>
              <p className="text-xs font-medium text-muted uppercase">{group}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {items.filter((i) => !v.equipment.some((x) => x.toLowerCase() === i.toLowerCase())).map((i) => (
                  <li key={i}>
                    <button type="button" onClick={() => toggleEq(i)} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:border-border-strong hover:text-text">
                      <Plus className="size-3.5" aria-hidden="true" />{i}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex gap-2">
            <label htmlFor="v-extra" className="sr-only">Autre équipement</label>
            <Input id="v-extra" value={extra} onChange={(e) => setExtra(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExtra(); } }} placeholder="Autre équipement (ex. pack hiver)" />
            <Button type="button" variant="secondary" onClick={addExtra}>Ajouter</Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Description" description="Affichée sur la fiche publique : état, entretien, points forts." />
        <div className="p-5">
          <label htmlFor="v-description" className="sr-only">Description</label>
          <Textarea id="v-description" rows={6} value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="Véhicule en très bon état, entretien chez le concessionnaire, pneus neufs…" />
        </div>
      </Card>

      <Card>
        <CardHeader title="Infos internes" description="Jamais affichées au public." />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          {txt("vin", "N° de châssis (VIN)", { maxLength: 17, autoComplete: "off", className: "uppercase" })}
          {txt("plate", "Plaque", { autoComplete: "off" })}
          {txt("purchase", "Prix d'achat (€)", { inputMode: "decimal" })}
          <div className="sm:col-span-3">
            <Field label="Note interne" htmlFor="v-internalNote">
              <Textarea id="v-internalNote" rows={3} value={v.internalNote} onChange={(e) => set("internalNote", e.target.value)} />
            </Field>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted sm:col-span-3"><Lock className="size-3.5" aria-hidden="true" />Visibles seulement par votre équipe dans Skydev.</p>
        </div>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Statut</span>
          <select value={v.status} onChange={(e) => set("status", e.target.value)} className="h-10 rounded-lg border border-border-strong bg-surface px-3 text-sm">
            {Object.entries(VEHICLE_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </label>
        {msg ? <p className={cn("text-sm", msg.ok ? "text-success" : "text-danger")} role={msg.ok ? "status" : "alert"}>{msg.ok ? <Check className="mr-1 inline size-4" aria-hidden="true" /> : null}{msg.text}</p> : null}
        <Button type="submit" loading={pending} className="ml-auto">{id ? "Enregistrer" : "Créer et ajouter les photos"}</Button>
      </div>
    </form>
  );
}
