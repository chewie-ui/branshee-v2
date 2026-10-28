"use client";

import { useState, useTransition } from "react";
import { unsubscribe } from "@/server/actions/marketing";
import type { PublicTexts } from "@/i18n/public-pages";

export function UnsubscribeButton({ token, done, tx }: { token: string; done: boolean; tx: PublicTexts["unsub"] }) {
  const [msg, setMsg] = useState<string | null>(done ? tx.done : null);
  const [pending, start] = useTransition();
  if (msg) return <p className="mt-4 rounded-lg bg-success-soft px-3 py-3 text-sm text-success" role="status">{msg}</p>;
  return (
    <>
      <p className="mt-2 text-muted">{tx.text}</p>
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await unsubscribe(token).catch(() => ({ ok: false as const, error: "Réessayez plus tard." })); setMsg(r.ok ? (r.message ?? "C'est fait.") : r.error); })} className="mt-5 h-11 w-full rounded-lg bg-accent font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-60">{pending ? "…" : tx.button}</button>
    </>
  );
}
