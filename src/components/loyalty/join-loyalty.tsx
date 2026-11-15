"use client";

import { useState, useTransition } from "react";
import { Gift } from "lucide-react";
import { joinLoyaltyAsClient, joinLoyaltyFromOrder } from "@/server/actions/loyalty-scan";

/** Rejoindre la carte de fidélité d'un commerce (depuis une commande ou l'espace client), puis ouvrir la carte. */
export function JoinLoyalty({ orderToken, businessId, label, busy, className }: { orderToken?: string; businessId?: string; label: string; busy: string; className?: string }) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const go = () => start(async () => {
    setErr(null);
    const r = orderToken ? await joinLoyaltyFromOrder(orderToken).catch(() => null) : await joinLoyaltyAsClient(businessId!).catch(() => null);
    if (!r) return setErr("Action impossible. Réessayez.");
    if (!r.ok) return setErr(r.error);
    window.location.href = `/fidelite/${r.token}`;
  });
  return (
    <div className={className}>
      <button type="button" onClick={go} disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-60"><Gift className="size-4" aria-hidden="true" />{pending ? busy : label}</button>
      {err ? <p className="mt-2 text-sm text-danger" role="alert">{err}</p> : null}
    </div>
  );
}
