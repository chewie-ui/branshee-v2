"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { newOptionId, type OptionGroup } from "@/lib/product-options";
import { useT } from "@/components/app-locale";

type Row = { id: string; name: string; price: string };
type Group = { id: string; name: string; multi: boolean; required: boolean; max: string; choices: Row[] };

const toEuro = (c: number) => (c ? (c / 100).toFixed(2).replace(".", ",") : "");
const toCents = (s: string) => { const n = Number(s.replace(",", ".").replace(/[^\d.]/g, "")); return Number.isFinite(n) ? Math.round(n * 100) : 0; };

/** Modèles rapides : le cas « sandwich » en un clic, tout reste modifiable. */
const TEMPLATES: { label: string; make: () => Group }[] = [
  { label: "Un choix obligatoire (ex. pain)", make: () => ({ id: newOptionId(), name: "Pain", multi: false, required: true, max: "", choices: [{ id: newOptionId(), name: "Blanc", price: "" }, { id: newOptionId(), name: "Gris", price: "" }] }) },
  { label: "Ingrédients à retirer (gratuit)", make: () => ({ id: newOptionId(), name: "Retirer", multi: true, required: false, max: "", choices: [{ id: newOptionId(), name: "Sans oignon", price: "" }, { id: newOptionId(), name: "Sans sauce", price: "" }] }) },
  { label: "Suppléments payants", make: () => ({ id: newOptionId(), name: "Suppléments", multi: true, required: false, max: "", choices: [{ id: newOptionId(), name: "Cheddar", price: "0,80" }, { id: newOptionId(), name: "Bacon", price: "1,20" }] }) },
  { label: "Composer (plusieurs garnitures)", make: () => ({ id: newOptionId(), name: "Garnitures", multi: true, required: true, max: "4", choices: [{ id: newOptionId(), name: "Poulet", price: "1,50" }, { id: newOptionId(), name: "Thon", price: "1,50" }, { id: newOptionId(), name: "Crudités", price: "0,50" }] }) },
];

/** Options d'un produit pour la boutique (sandwich à composer, retirer un ingrédient, suppléments). */
export function OptionsEditor({ initial }: { initial: OptionGroup[] }) {
  const t = useT();
  const [groups, setGroups] = useState<Group[]>(() => initial.map((g) => ({ ...g, max: g.max ? String(g.max) : "", choices: g.choices.map((c) => ({ id: c.id, name: c.name, price: toEuro(c.priceCents) })) })));
  const json = JSON.stringify(groups.map((g) => ({ id: g.id, name: g.name.trim(), multi: g.multi, required: g.required, max: g.multi && g.max ? Math.max(1, Number(g.max) || 1) : null, choices: g.choices.filter((c) => c.name.trim()).map((c) => ({ id: c.id, name: c.name.trim(), priceCents: toCents(c.price) })) })));
  const set = (i: number, patch: Partial<Group>) => setGroups((gs) => gs.map((g, k) => (k === i ? { ...g, ...patch } : g)));
  const setChoice = (i: number, j: number, patch: Partial<Row>) => set(i, { choices: groups[i]!.choices.map((c, k) => (k === j ? { ...c, ...patch } : c)) });
  const input = "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm";

  return (
    <div className="space-y-3">
      <input type="hidden" name="options" value={json} />
      {groups.map((g, i) => (
        <div key={g.id} className="space-y-3 rounded-lg border border-border bg-surface-muted/50 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-40 flex-1 text-sm">{t("Nom du groupe")}<input className={`${input} mt-1`} value={g.name} onChange={(e) => set(i, { name: e.target.value })} maxLength={60} placeholder={t("Ex. : Pain, Suppléments")} /></label>
            <label className="text-sm">{t("Le client choisit")}
              <select className={`${input} mt-1 w-auto`} value={g.multi ? "multi" : "one"} onChange={(e) => set(i, { multi: e.target.value === "multi" })}>
                <option value="one">{t("un seul")}</option>
                <option value="multi">{t("plusieurs")}</option>
              </select>
            </label>
            {g.multi ? <label className="w-24 text-sm">{t("Maximum")}<input className={`${input} mt-1`} inputMode="numeric" value={g.max} onChange={(e) => set(i, { max: e.target.value.replace(/\D/g, "").slice(0, 2) })} placeholder={t("libre")} /></label> : null}
            <button type="button" onClick={() => setGroups((gs) => gs.filter((_, k) => k !== i))} className="flex size-10 items-center justify-center rounded-lg text-danger hover:bg-danger-soft" aria-label={t("Supprimer le groupe")}><Trash2 className="size-4" aria-hidden="true" /></button>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={g.required} onChange={(e) => set(i, { required: e.target.checked })} className="size-4" />{t("Choix obligatoire")}</label>
          <ul className="space-y-2">
            {g.choices.map((c, j) => (
              <li key={c.id} className="flex items-center gap-2">
                <input className={input} value={c.name} onChange={(e) => setChoice(i, j, { name: e.target.value })} maxLength={60} placeholder={t("Nom du choix")} aria-label={t("Nom du choix")} />
                <span className="relative w-28 shrink-0">
                  <input className={`${input} pr-7 text-right`} inputMode="decimal" value={c.price} onChange={(e) => setChoice(i, j, { price: e.target.value })} placeholder="0,00" aria-label={t("Prix en plus (€)")} />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">€</span>
                </span>
                <button type="button" onClick={() => set(i, { choices: g.choices.filter((_, k) => k !== j) })} disabled={g.choices.length <= 1} className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-danger disabled:opacity-30" aria-label={t("Retirer ce choix")}><Trash2 className="size-4" aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => set(i, { choices: [...g.choices, { id: newOptionId(), name: "", price: "" }] })} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"><Plus className="size-4" aria-hidden="true" />{t("Ajouter un choix")}</button>
        </div>
      ))}
      <div>
        <p className="text-sm font-medium">{groups.length ? t("Ajouter un autre groupe") : t("Ajouter des options")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TEMPLATES.map((tp) => (
            <button key={tp.label} type="button" onClick={() => setGroups((gs) => [...gs, tp.make()])} className="inline-flex h-9 items-center gap-1 rounded-full border border-border-strong px-3 text-sm hover:bg-surface-muted"><Plus className="size-4" aria-hidden="true" />{t(tp.label)}</button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{t("Le prix indiqué s'ajoute au prix du produit (0 = gratuit). Pour un sandwich « à composer », mettez le prix de base au produit et des choix obligatoires.")}</p>
      </div>
    </div>
  );
}
