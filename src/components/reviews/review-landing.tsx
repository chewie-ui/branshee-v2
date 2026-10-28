"use client";

import { useState, useTransition } from "react";
import { Check, MessageSquare, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { submitPrivateFeedback } from "@/server/actions/google-reviews";
import { fill, type PublicTexts } from "@/i18n/public-pages";

export function ReviewLanding({ token, businessName, photoUrl, hasGoogle, alreadySent, tx }: { token: string; businessName: string; photoUrl: string | null; hasGoogle: boolean; alreadySent: boolean; tx: PublicTexts["review"] }) {
  const [priv, setPriv] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [done, setDone] = useState<string | null>(alreadySent ? tx.sent : null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return setError(tx.chooseRating);
    start(async () => {
      setError(null);
      const r: { ok: boolean; message?: string; error?: string } = await submitPrivateFeedback({ token, rating, text }).catch(() => ({ ok: false, error: "Envoi impossible. Réessayez." }));
      if (!r.ok) return setError(r.error ?? "Envoi impossible.");
      setDone(r.message ?? "Merci !");
    });
  };
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center shadow-sm">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="mx-auto size-16 rounded-2xl object-cover" />
        ) : null}
        <h1 className="mt-3 text-xl font-semibold">{businessName}</h1>
        <p className="mt-1 text-muted">{tx.thanks}</p>
        {hasGoogle ? (
          <a href={`/avis/${token}/google`} className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-accent-foreground hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <Star className="size-5" aria-hidden="true" />{tx.google}
          </a>
        ) : <p className="mt-6 text-sm text-muted">{tx.noGoogle}</p>}
        {done ? (
          <p className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-success-soft px-3 py-3 text-sm text-success" role="status"><Check className="size-4" aria-hidden="true" />{done}</p>
        ) : !priv ? (
          <button type="button" onClick={() => setPriv(true)} className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted hover:bg-surface-muted hover:text-text"><MessageSquare className="size-4" aria-hidden="true" />{tx.private}</button>
        ) : (
          <form onSubmit={send} className="mt-6 space-y-3 text-left" noValidate>
            <p className="text-sm font-medium" id="rl-rate">{tx.rating}</p>
            <div className="flex justify-center gap-1" role="radiogroup" aria-labelledby="rl-rate">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={fill(tx.ofFive, { n })} onClick={() => setRating(n)} className="flex size-11 items-center justify-center rounded-lg hover:bg-surface-muted">
                  <Star className={cn("size-7", n <= rating ? "fill-warning text-warning" : "text-border-strong")} aria-hidden="true" />
                </button>
              ))}
            </div>
            <label htmlFor="rl-text" className="block text-sm font-medium">{tx.message}</label>
            <textarea id="rl-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} className="w-full rounded-lg border border-border bg-surface px-3 py-2" />
            {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
            <button type="submit" disabled={pending} className="h-11 w-full rounded-lg border border-border-strong font-medium hover:bg-surface-muted disabled:opacity-60">{pending ? "…" : tx.sendPrivate}</button>
          </form>
        )}
      </div>
    </div>
  );
}
