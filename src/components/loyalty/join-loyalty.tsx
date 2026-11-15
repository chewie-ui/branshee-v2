"use client";

import { useState, useTransition } from "react";
import { Gift } from "lucide-react";
import { joinLoyaltyAsClient, joinLoyaltyFromOrder } from "@/server/actions/loyalty-scan";

/** Rejoindre la carte de fidélité d'un commerce (depuis une commande ou l'espace client), puis ouvrir la carte (ou l'envoyer par email). */
export function JoinLoyalty({ orderToken, businessId, label, busy, emailed, className }: { orderToken?: string; businessId?: string; label: string; busy: string; emailed?: string; className?: string }) {
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const go = () => start(async () => {
    setErr(null);
    const r = orderToken ? await joinLoyaltyFromOrder(orderToken).catch(() => null) : await joinLoyaltyAsClient(businessId!).catch(() => null);
    if (!r) return setErr("Action impossible. Réessayez.");
    if (!r.ok) return setErr(r.error);
    // Carte ouverte depuis une commande sans compte vérifié : son lien part par email, il n'est pas affiché ici.
    if (!r.token) return setSent(true);
    window.location.href = `/fidelite/${r.token}`;
  });
  if (sent) return <p className={`${className ?? ""} rounded-lg bg-success-soft px-3 py-2 text-sm text-success`} role="status">{emailed}</p>;
  return (
    <div className={className}>
      <button type="button" onClick={go} disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-60"><Gift className="size-4" aria-hidden="true" />{pending ? busy : label}</button>
      {err ? <p className="mt-2 text-sm text-danger" role="alert">{err}</p> : null}
    </div>
  );
}
