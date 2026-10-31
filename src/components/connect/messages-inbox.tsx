"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inbox, Mail, Phone, Trash2, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/invoicing/confirm-dialog";
import { cn } from "@/lib/cn";
import { deleteContactMessage, setMessageRead } from "@/server/actions/connect";

type Row = { id: string; name: string; email: string | null; phone: string | null; subject: string | null; message: string; source: string; pageUrl: string | null; customerId: string | null; read: boolean; createdAt: string };

export function MessagesInbox({ rows, canManage, timezone }: { rows: Row[]; canManage: boolean; timezone: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [del, setDel] = useState<Row | null>(null);
  const [pending, start] = useTransition();
  const fmt = new Intl.DateTimeFormat("fr-BE", { timeZone: timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const toggle = (r: Row) => {
    setOpen(open === r.id ? null : r.id);
    if (!r.read) start(async () => { await setMessageRead(r.id, true).catch(() => null); router.refresh(); });
  };
  if (!rows.length)
    return (
      <Card className="p-10 text-center">
        <Inbox className="mx-auto size-8 text-muted" aria-hidden="true" />
        <p className="mt-3 font-medium">Aucun message pour l&apos;instant</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">Ajoutez le formulaire de contact sur votre site (Réglages › Connecter un site) : chaque message arrivera ici, avec la fiche client créée.</p>
        <Link href="/app/reglages/site-connecte" className="mt-4 inline-flex h-10 items-center rounded-lg border border-border-strong px-4 text-sm font-medium hover:bg-surface-muted">Connecter mon site</Link>
      </Card>
    );
  return (
    <>
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {rows.map((r) => (
        <li key={r.id}>
          <button type="button" onClick={() => toggle(r)} aria-expanded={open === r.id} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-muted/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent">
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", r.read ? "bg-transparent" : "bg-accent")} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className={cn("truncate", r.read ? "font-medium" : "font-semibold")}>{r.name}</span>
                {!r.read ? <Badge tone="accent">Nouveau</Badge> : null}
                {r.source === "api" ? <Badge>Site sur mesure</Badge> : null}
              </span>
              <span className="block truncate text-sm text-muted">{r.subject ? `${r.subject} · ` : ""}{r.message}</span>
            </span>
            <span className="shrink-0 text-xs text-muted tabular-nums">{fmt.format(new Date(r.createdAt))}</span>
          </button>
          {open === r.id ? (
            <div className="space-y-3 border-t border-border bg-surface-muted/40 px-4 py-4 pl-9 text-sm">
              {r.subject ? <p className="font-medium">{r.subject}</p> : null}
              <p className="max-w-prose whitespace-pre-line">{r.message}</p>
              <div className="flex flex-wrap gap-2">
                {r.email ? <a href={`mailto:${r.email}?subject=${encodeURIComponent(r.subject ? `Re: ${r.subject}` : "Votre message")}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 font-medium text-accent-foreground hover:bg-accent-hover"><Mail className="size-4" aria-hidden="true" />Répondre</a> : null}
                {r.phone ? <a href={`tel:${r.phone.replace(/[^+0-9]/g, "")}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong px-3 font-medium hover:bg-surface-muted"><Phone className="size-4" aria-hidden="true" />{r.phone}</a> : null}
                {r.customerId ? <Link href={`/app/clients/${r.customerId}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong px-3 font-medium hover:bg-surface-muted"><UserRound className="size-4" aria-hidden="true" />Fiche client</Link> : null}
                <button type="button" disabled={pending} onClick={() => start(async () => { await setMessageRead(r.id, false).catch(() => null); setOpen(null); router.refresh(); })} className="inline-flex h-9 items-center rounded-lg px-3 text-muted hover:bg-surface-muted hover:text-text">Marquer non lu</button>
                {canManage ? <button type="button" onClick={() => setDel(r)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-danger hover:bg-danger-soft"><Trash2 className="size-4" aria-hidden="true" />Supprimer</button> : null}
              </div>
              {r.pageUrl ? <p className="text-xs text-muted">Envoyé depuis : {r.pageUrl}</p> : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
      <ConfirmDialog open={!!del} title="Supprimer ce message ?" confirmLabel="Supprimer" danger loading={pending} onCancel={() => setDel(null)} onConfirm={() => del && start(async () => { await deleteContactMessage(del.id).catch(() => null); setDel(null); setOpen(null); router.refresh(); })}>
        Le message est supprimé. La fiche client, elle, reste.
      </ConfirmDialog>
    </>
  );
}
