"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { acceptInvitation, cancelJoinRequest, decideJoinRequest, declineInvitation, deleteBusinessByOwner, leaveBusiness, requestJoin, searchBusinesses, setBusinessPausedByOwner } from "@/server/actions/memberships";

type R = { ok: true; message?: string } | { ok: false; error: string };

function useRun() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<R>) => start(async () => { const r = await fn(); setMsg(r.ok ? { ok: true, text: r.message ?? "Fait." } : { ok: false, text: r.error }); });
  const node = msg ? <p className={cn("text-sm", msg.ok ? "text-success" : "text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null;
  return { pending, run, node };
}

export function InvitationButtons({ memberId }: { memberId: string }) {
  const { pending, run, node } = useRun();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" loading={pending} onClick={() => run(() => acceptInvitation(memberId))}>Accepter</Button>
      <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => declineInvitation(memberId))}>Refuser</Button>
      {node}
    </div>
  );
}

export function CancelRequestButton({ memberId }: { memberId: string }) {
  const { pending, run } = useRun();
  return <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => cancelJoinRequest(memberId))}>Annuler la demande</Button>;
}

export function JoinRequestButtons({ memberId }: { memberId: string }) {
  const { pending, run, node } = useRun();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" loading={pending} onClick={() => run(() => decideJoinRequest(memberId, true))}>Accepter</Button>
      <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => decideJoinRequest(memberId, false))}>Refuser</Button>
      {node}
    </div>
  );
}

export function JoinSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchBusinesses>> | null>(null);
  const [searching, startSearch] = useTransition();
  const [sent, setSent] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); startSearch(async () => setResults(await searchBusinesses(q))); }}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom de l'établissement ou ville" className="pl-9" aria-label="Rechercher un établissement" minLength={2} />
        </div>
        <Button type="submit" variant="secondary" loading={searching}>Rechercher</Button>
      </form>
      {results ? (
        results.length === 0 ? (
          <p className="text-sm text-muted">Aucun établissement trouvé.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {results.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={b.name} src={b.photoUrl} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{b.name}</p>
                  <p className="text-muted">{[b.businessType, b.city].filter(Boolean).join(" · ")}</p>
                </div>
                {sent[b.id] ? (
                  <span className="text-sm text-muted">{sent[b.id]}</span>
                ) : (
                  <Button size="sm" variant="secondary" loading={pending} onClick={() => start(async () => { const r = await requestJoin(b.id); setSent((s) => ({ ...s, [b.id]: r.ok ? "Demande envoyée" : r.error })); })}>Demander à rejoindre</Button>
                )}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

export function OwnerControls({ businessId, name, paused }: { businessId: string; name: string; paused: boolean }) {
  const { pending, run, node } = useRun();
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => setBusinessPausedByOwner(businessId, !paused))}>{paused ? "Réactiver la réservation en ligne" : "Mettre en pause"}</Button>
        {confirm === null ? <Button size="sm" variant="ghost" onClick={() => setConfirm("")}>Supprimer…</Button> : null}
      </div>
      {confirm !== null ? (
        <form className="space-y-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm" onSubmit={(e) => { e.preventDefault(); run(() => deleteBusinessByOwner(businessId, confirm)); }}>
          <p className="text-danger">Suppression définitive de « {name} » : la page de réservation disparaît et l&apos;équipe perd l&apos;accès. Tapez le nom pour confirmer.</p>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Nom de l'établissement" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="danger" loading={pending} disabled={confirm.trim().toLowerCase() !== name.trim().toLowerCase()}>Supprimer définitivement</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm(null)}>Annuler</Button>
          </div>
        </form>
      ) : null}
      {node}
    </div>
  );
}

export function LeaveButton({ businessId }: { businessId: string }) {
  const { pending, run, node } = useRun();
  const [sure, setSure] = useState(false);
  return (
    <div className="flex items-center gap-2">
      {sure ? <Button size="sm" variant="danger" loading={pending} onClick={() => run(() => leaveBusiness(businessId))}>Confirmer</Button> : <Button size="sm" variant="ghost" onClick={() => setSure(true)}>Quitter</Button>}
      {node}
    </div>
  );
}
