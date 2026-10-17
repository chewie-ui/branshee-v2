"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Trash2, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { deleteCustomers } from "@/server/actions/customers";

type Row = { id: string; name: string; email: string | null; phone: string | null; blocked: boolean; count: number; last: string | null; lastStatus: string | null; member: string | null };
const STATUS: Record<string, { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  confirmed: { label: "Confirmé", tone: "success" },
  pending: { label: "À confirmer", tone: "warning" },
  cancelled: { label: "Annulé", tone: "danger" },
  noshow: { label: "Absent", tone: "warning" },
};

export function CustomersTable({ rows, term, filtered, canDelete }: { rows: Row[]; term: string; filtered: boolean; canDelete: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const all = rows.length > 0 && selected.length === rows.length;

  if (rows.length === 0)
    return <EmptyState icon={<UserRound />} title={filtered ? `Aucun ${term} trouvé` : `Pas encore de ${term}`} description={filtered ? "Modifiez la recherche ou les filtres." : `Vos ${term}s apparaîtront ici dès leur première réservation. Vous pouvez aussi en ajouter un vous-même.`} />;

  return (
    <>
      {canDelete && selected.length ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-accent-soft px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.length} sélectionné{selected.length > 1 ? "s" : ""}</span>
          <button type="button" onClick={() => setSelected([])} className="text-muted hover:text-text">Tout désélectionner</button>
          {confirm ? (
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <span className="text-danger">Supprimer ces fiches, leurs dossiers et leurs rendez-vous ?</span>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)} disabled={pending}>Non</Button>
              <Button size="sm" variant="danger" loading={pending} onClick={() => start(async () => { await deleteCustomers(selected); setSelected([]); setConfirm(false); })}>Oui, supprimer</Button>
            </span>
          ) : (
            <Button size="sm" variant="ghost" className="ml-auto text-danger hover:text-danger" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirm(true)}>Supprimer</Button>
          )}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-muted text-left text-xs text-muted">
            <tr>
              {canDelete ? <th className="w-10 px-4 py-2.5"><input type="checkbox" checked={all} onChange={() => setSelected(all ? [] : rows.map((r) => r.id))} className="size-4 accent-[var(--accent)]" aria-label="Tout sélectionner" /></th> : null}
              <th scope="col" className="px-4 py-2.5 font-medium first-letter:uppercase">{term}</th>
              <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">Téléphone</th>
              <th scope="col" className="hidden px-4 py-2.5 font-medium lg:table-cell">Praticien</th>
              <th scope="col" className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">RDV</th>
              <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">Dernier RDV</th>
              <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-surface-muted/60">
                {canDelete ? <td className="px-4 py-3"><input type="checkbox" checked={selected.includes(c.id)} onChange={() => setSelected((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))} className="size-4 accent-[var(--accent)]" aria-label={`Sélectionner ${c.name}`} /></td> : null}
                <td className="px-4 py-3">
                  <Link href={`/app/clients/${c.id}`} className="flex items-center gap-3">
                    <Avatar name={c.name} size="sm" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-medium text-text">
                        <span className="truncate">{c.name}</span>
                        {c.blocked ? <Badge tone="danger">Bloqué</Badge> : null}
                      </span>
                      {c.email ? <span className="block truncate text-muted">{c.email}</span> : null}
                      <span className="block text-muted sm:hidden">{c.last ? `Dernier RDV : ${c.last}` : "Aucun RDV"}</span>
                    </span>
                  </Link>
                </td>
                <td className="hidden px-4 py-3 whitespace-nowrap text-muted md:table-cell">{c.phone ?? "—"}</td>
                <td className="hidden px-4 py-3 text-muted lg:table-cell">{c.member ?? "—"}</td>
                <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{c.count}</td>
                <td className="hidden px-4 py-3 whitespace-nowrap text-muted sm:table-cell">{c.last ?? "—"}</td>
                <td className="hidden px-4 py-3 md:table-cell">{c.lastStatus && STATUS[c.lastStatus] ? <Badge tone={STATUS[c.lastStatus]!.tone}>{STATUS[c.lastStatus]!.label}</Badge> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
