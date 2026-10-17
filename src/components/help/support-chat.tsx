"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { fetchSupportThread, rateSupport, sendSupportMessage } from "@/server/actions/support";
import type { SupportMessageView } from "@/server/support";

type Thread = { unreadByUser: number; closedAt: string | null; rated: boolean } | null;

const time = (iso: string) => new Date(iso).toLocaleString("fr-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Discussion directe avec l'équipe Branshee (rafraîchie toutes les 10 s tant que la page est ouverte). */
export function SupportChat({ initial, firstName }: { initial: { thread: Thread; messages: SupportMessageView[] }; firstName: string }) {
  const [data, setData] = useState(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [pending, start] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      fetchSupportThread().then((d) => alive && setData(d)).catch(() => {});
    };
    refresh();
    const t = window.setInterval(refresh, 10000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  const count = data.messages.length;
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setError(null);
    start(async () => {
      const r = await sendSupportMessage(body);
      if (!r.ok) return setError(r.error ?? "Envoi impossible.");
      setText("");
      setData(await fetchSupportThread());
    });
  }

  const closed = !!data.thread?.closedAt;
  return (
    <div className="flex flex-col">
      <div ref={listRef} className="max-h-[420px] min-h-48 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
        {count === 0 ? (
          <div className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-muted">
            Bonjour {firstName} 👋 Une question, un souci, une idée ? Écrivez-nous ici : un humain de l&apos;équipe vous répond, souvent dans la journée.
          </div>
        ) : (
          data.messages.map((m) => (
            <div key={m.id} className={cn("flex", m.sender === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm", m.sender === "user" ? "rounded-br-sm bg-accent text-accent-foreground" : "rounded-bl-sm bg-surface-muted text-text")}>
                {m.sender === "admin" ? <p className="mb-0.5 text-xs font-semibold text-accent">Équipe Branshee</p> : null}
                <p className="whitespace-pre-line break-words">{m.body}</p>
                <p className={cn("mt-1 text-[11px]", m.sender === "user" ? "text-accent-foreground/70" : "text-muted")}>{time(m.createdAt)}</p>
              </div>
            </div>
          ))
        )}
        {closed ? (
          <div className="rounded-lg border border-border px-4 py-3 text-center text-sm">
            <p className="font-medium">Conversation terminée</p>
            {data.thread?.rated ? (
              <p className="mt-1 text-muted">Merci pour votre avis !</p>
            ) : (
              <>
                <p className="mt-1 text-muted">Comment s&apos;est passé cet échange ?</p>
                <div className="mt-2 flex justify-center gap-1" role="radiogroup" aria-label="Votre note">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
                      disabled={pending}
                      onClick={() => {
                        setRating(n);
                        start(async () => {
                          const r = await rateSupport(n);
                          if (r.ok) setData((d) => ({ ...d, thread: d.thread ? { ...d.thread, rated: true } : d.thread }));
                        });
                      }}
                      className="rounded p-1 text-warning hover:scale-110"
                    >
                      <Star className={cn("size-6", n <= rating ? "fill-current" : "")} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </>
            )}
            <p className="mt-2 text-xs text-muted">Une autre question ? Écrivez simplement un nouveau message.</p>
          </div>
        ) : null}
      </div>
      <form onSubmit={send} className="border-t border-border p-3">
        <label htmlFor="support-msg" className="sr-only">Votre message</label>
        <div className="flex items-end gap-2">
          <textarea
            id="support-msg"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
            maxLength={4000}
            placeholder="Votre message…"
            className="min-h-10 flex-1 resize-y rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/30"
          />
          <Button type="submit" loading={pending} disabled={!text.trim()} icon={<Send className="size-4" aria-hidden="true" />} aria-label="Envoyer">
            <span className="hidden sm:inline">Envoyer</span>
          </Button>
        </div>
        {error ? <p className="mt-2 text-sm text-danger" role="alert">{error}</p> : null}
      </form>
    </div>
  );
}
