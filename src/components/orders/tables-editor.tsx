"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/invoicing/confirm-dialog";
import { cn } from "@/lib/cn";
import { addTables, deleteTable, regenerateTable, renameTable } from "@/server/actions/orders";

type Row = { id: string; label: string; url: string; qr: string };
type Res = { ok: boolean; message?: string; error?: string };

/** Tables du restaurant et leurs QR codes : ajout en série, renommer, nouveau QR, impression. */
export function TablesEditor({ tables, canEdit }: { tables: Row[]; canEdit: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [prefix, setPrefix] = useState("Table");
  const [from, setFrom] = useState(String(tables.length + 1));
  const [count, setCount] = useState(tables.length ? "1" : "10");
  const [rename, setRename] = useState<{ id: string; label: string } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "regen"; row: Row } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Res>, after?: () => void) =>
    start(async () => {
      const r: Res = await fn().catch(() => ({ ok: false, error: "Action impossible. Vérifiez votre connexion." }));
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Enregistré.") : (r.error ?? "Action impossible.") });
      if (r.ok) after?.();
      router.refresh();
    });

  return (
    <div className="space-y-4">
      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      {canEdit ? (
        <Card className="p-5">
          <form className="grid gap-3 sm:grid-cols-[1fr_120px_120px_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); run(() => addTables({ prefix, from: Number(from) || 1, count: Number(count) || 1 }), () => setFrom(String((Number(from) || 1) + (Number(count) || 1)))); }}>
            <Field label="Nom" htmlFor="tb-prefix"><Input id="tb-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} maxLength={30} placeholder="Table, Terrasse…" /></Field>
            <Field label="À partir du n°" htmlFor="tb-from"><Input id="tb-from" inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="Combien" htmlFor="tb-count"><Input id="tb-count" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} /></Field>
            <Button type="submit" loading={pending} icon={<Plus className="size-4" aria-hidden="true" />}>Ajouter</Button>
          </form>
        </Card>
      ) : null}
      {tables.length ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted">{tables.length} table{tables.length > 1 ? "s" : ""}</p>
            <a href="/imprimer/tables" target="_blank" rel="noopener" className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><Printer className="size-4" aria-hidden="true" />Imprimer les QR codes</a>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tables.map((t) => (
              <li key={t.id}>
                <Card className="p-4">
                  {rename?.id === t.id ? (
                    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => renameTable(t.id, rename.label), () => setRename(null)); }}>
                      <label htmlFor={`tn-${t.id}`} className="sr-only">Nom de la table</label>
                      <Input id={`tn-${t.id}`} value={rename.label} onChange={(e) => setRename({ ...rename, label: e.target.value })} maxLength={40} autoFocus />
                      <Button size="sm" type="submit" className="h-10" loading={pending}>OK</Button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-1">
                      <p className="min-w-0 flex-1 truncate font-semibold">{t.label}</p>
                      {canEdit ? <button type="button" onClick={() => setRename({ id: t.id, label: t.label })} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted" aria-label={`Renommer ${t.label}`}><Pencil className="size-4" aria-hidden="true" /></button> : null}
                    </div>
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.qr} alt={`QR code de ${t.label}`} className="mx-auto mt-3 size-40" />
                  <div className="mt-3 flex flex-wrap justify-center gap-1">
                    <button type="button" onClick={() => { navigator.clipboard?.writeText(t.url).then(() => setMsg({ ok: true, text: `Lien de ${t.label} copié.` }), () => {}); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted hover:bg-surface-muted hover:text-text"><Copy className="size-4" aria-hidden="true" />Lien</button>
                    <a href={t.url} target="_blank" rel="noopener" className="inline-flex h-9 items-center rounded-lg px-2 text-sm text-muted hover:bg-surface-muted hover:text-text">Tester</a>
                    {canEdit ? (
                      <>
                        <button type="button" onClick={() => setConfirm({ kind: "regen", row: t })} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted hover:bg-surface-muted hover:text-text"><RefreshCw className="size-4" aria-hidden="true" />Nouveau QR</button>
                        <button type="button" onClick={() => setConfirm({ kind: "delete", row: t })} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger" aria-label={`Supprimer ${t.label}`}><Trash2 className="size-4" aria-hidden="true" /></button>
                      </>
                    ) : null}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      ) : <Card className="p-8 text-center"><p className="font-medium">Aucune table</p><p className="mt-1 text-sm text-muted">Ajoutez vos tables : chacune reçoit son QR code à imprimer et à poser dessus.</p></Card>}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.kind === "delete" ? `Supprimer ${confirm.row.label} ?` : `Nouveau QR code pour ${confirm?.row.label ?? ""} ?`}
        confirmLabel={confirm?.kind === "delete" ? "Supprimer" : "Créer un nouveau QR"}
        danger={confirm?.kind === "delete"}
        loading={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && run(() => (confirm.kind === "delete" ? deleteTable(confirm.row.id) : regenerateTable(confirm.row.id)), () => setConfirm(null))}
      >
        {confirm?.kind === "delete" ? "Son QR code ne fonctionnera plus. Les commandes passées restent dans l'historique." : "L'ancien QR code ne fonctionnera plus : utile si quelqu'un a pris une photo du code. Pensez à réimprimer."}
      </ConfirmDialog>
    </div>
  );
}
