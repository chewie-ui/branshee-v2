"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { money, UNITS, VAT_RATES } from "@/lib/invoicing";
import { deleteProduct, saveProduct } from "@/server/actions/invoicing";

type Item = { id: string; name: string; unit: string; price: number; vat: number };

/** Catalogue de prestations réutilisables ; les prestations RDV avec un prix y sont aussi proposées. */
export function CatalogManager({ items, services, franchise, canManage }: { items: Item[]; services: { id: string; name: string; price: number }[]; franchise: boolean; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [form, setForm] = useState({ name: "", unit: "forfait", price: "", vat: "21" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const open = (it: Item | "new") => {
    setEditing(it);
    setError(null);
    setForm(it === "new" ? { name: "", unit: "forfait", price: "", vat: "21" } : { name: it.name, unit: it.unit, price: String(it.price), vat: String(it.vat) });
  };
  const submit = () =>
    start(async () => {
      const r = await saveProduct(editing && editing !== "new" ? editing.id : null, form);
      if (!r.ok) return setError(r.error);
      setEditing(null);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      {canManage ? (
        <div className="flex justify-end">
          <Button icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => open("new")}>Ajouter au catalogue</Button>
        </div>
      ) : null}
      {editing ? (
        <Card className="p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr]">
            <Field label="Nom" htmlFor="p-name"><Input id="p-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex. : Bilan initial" /></Field>
            <Field label="Unité" htmlFor="p-unit"><Select id="p-unit" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>{UNITS.map((u) => <option key={u}>{u}</option>)}</Select></Field>
            <Field label={`Prix${franchise ? "" : " HTVA"} (€)`} htmlFor="p-price"><Input id="p-price" type="number" step="0.01" min="0" inputMode="decimal" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} /></Field>
            {franchise ? null : <Field label="TVA" htmlFor="p-vat"><Select id="p-vat" value={form.vat} onChange={(e) => setForm((f) => ({ ...f, vat: e.target.value }))}>{VAT_RATES.map((r) => <option key={r} value={r}>{r} %</option>)}</Select></Field>}
          </div>
          {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}
          <div className="mt-4 flex gap-2">
            <Button loading={pending} onClick={submit}>Enregistrer</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Annuler</Button>
          </div>
        </Card>
      ) : null}
      <Card>
        {items.length === 0 ? (
          <EmptyState icon={<Package />} title="Catalogue vide" description="Enregistrez vos prestations et produits habituels : vous les ajouterez à une facture en un clic." />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="min-w-0 flex-1 font-medium">{it.name}</span>
                <span className="text-muted">{it.unit}</span>
                <span className="w-24 text-right font-medium tabular-nums">{money(it.price)}</span>
                {franchise ? null : <span className="w-12 text-right text-muted">{it.vat} %</span>}
                {canManage ? (
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" aria-label={`Modifier ${it.name}`} onClick={() => open(it)}><Pencil className="size-4" aria-hidden="true" /></Button>
                    <Button size="sm" variant="ghost" aria-label={`Supprimer ${it.name}`} disabled={pending} onClick={() => start(async () => { await deleteProduct(it.id); router.refresh(); })}><Trash2 className="size-4" aria-hidden="true" /></Button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {services.length ? (
        <Card>
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Vos prestations RDV</h2>
            <p className="mt-0.5 text-sm text-muted">Déjà disponibles dans les factures, avec le prix de votre page de réservation.</p>
          </div>
          <ul className="divide-y divide-border">
            {services.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="flex-1">{s.name}</span>
                <span className="font-medium tabular-nums">{money(s.price)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
