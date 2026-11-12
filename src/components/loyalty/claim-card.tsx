"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { claimLoyaltyCard } from "@/server/actions/loyalty-scan";

type Tx = { saveTitle: string; saveText: string; firstName: string; email: string; save: string; saving: string; saved: string; merged: string; account: string };

/** Carte sans email : le client l'ajoute quand il veut (pas au comptoir), pour ne pas la perdre. */
export function ClaimCard({ token, tx, signupHref }: { token: string; tx: Tx; signupHref: string }) {
  const router = useRouter();
  const [f, setF] = useState({ firstName: "", email: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const input = "mt-1 h-11 w-full rounded-lg border border-border-strong bg-surface px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent";
  if (msg?.ok) return <p className="rounded-2xl bg-success-soft px-4 py-3 text-center text-sm font-medium text-success" role="status">{msg.text}</p>;
  return (
    <section className="rounded-2xl bg-surface p-5" aria-labelledby="save-card">
      <h2 id="save-card" className="flex items-center gap-2 text-sm font-semibold"><Mail className="size-4 text-accent" aria-hidden="true" />{tx.saveTitle}</h2>
      <p className="mt-1 text-sm text-muted">{tx.saveText}</p>
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await claimLoyaltyCard({ token, ...f }).catch(() => ({ ok: false as const, error: "Connexion impossible. Réessayez." }));
            if (r.ok) { setMsg({ ok: true, text: r.merged ? tx.merged : tx.saved }); if (!r.merged) router.refresh(); }
            else setMsg({ ok: false, text: r.error });
          });
        }}
      >
        <div><label htmlFor="cc-first" className="text-sm font-medium">{tx.firstName}</label><input id="cc-first" className={input} value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} autoComplete="given-name" maxLength={60} required /></div>
        <div><label htmlFor="cc-email" className="text-sm font-medium">{tx.email}</label><input id="cc-email" type="email" className={input} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" maxLength={200} required /></div>
        {msg && !msg.ok ? <p className="text-sm text-danger" role="alert">{msg.text}</p> : null}
        <button type="submit" disabled={pending} className="flex h-11 w-full items-center justify-center rounded-xl bg-accent text-sm font-semibold text-accent-foreground transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">{pending ? tx.saving : tx.save}</button>
      </form>
      <a href={signupHref} className="mt-3 block text-center text-sm font-medium text-accent hover:underline">{tx.account}</a>
    </section>
  );
}
