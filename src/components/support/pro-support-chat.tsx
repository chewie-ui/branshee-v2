"use client";

import { useState, useTransition } from "react";
import { MessagesSquare, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { useBrandName } from "@/components/brand-context";
import { LiveChat, useLiveChat } from "@/components/support/live-chat";
import { endSupportChat, rateSupport, sendSupportMessage, startSupportChat, supportTyping } from "@/server/actions/support";
import type { SupportLive } from "@/server/support";

/**
 * Chat avec l'équipe, côté pro (bouton « Aide » et page Aide) :
 * « Démarrer le chat » → message d'accueil ; discussion en direct ; « Terminer » puis note.
 */
export function ProSupportChat({ initial, className, onEnded }: { initial?: SupportLive | null; className?: string; onEnded?: () => void }) {
  const brand = useBrandName();
  const { messages, thread, loaded, poll } = useLiveChat("/api/support", initial);
  const [busy, start] = useTransition();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [rating, setRating] = useState(0);
  const open = !!thread && !thread.closedAt;

  const begin = () => start(async () => {
    await startSupportChat();
    await poll();
  });

  if (!loaded) return <div className={cn("flex flex-1 items-center justify-center p-8 text-sm text-muted", className)}>Chargement…</div>;

  // Pas encore de discussion : un seul bouton pour la démarrer.
  if (!thread || (!open && messages.length === 0)) {
    return (
      <div className={cn("flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center", className)}>
        <span className="flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-soft-foreground" aria-hidden="true"><MessagesSquare className="size-7" /></span>
        <div>
          <p className="font-semibold">Discutez avec l&apos;équipe {brand}</p>
          <p className="mt-1 max-w-xs text-sm text-muted">Un humain vous répond, en général en quelques minutes en journée. Vous pouvez envoyer des captures d&apos;écran.</p>
        </div>
        <button type="button" onClick={begin} disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 font-medium text-accent-foreground transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60">
          <MessagesSquare className="size-4" aria-hidden="true" />{busy ? "Ouverture…" : "Démarrer le chat"}
        </button>
      </div>
    );
  }

  const ended = thread.closedAt ? (
    <div className="mt-3 rounded-xl border border-border p-4 text-center text-sm">
      {thread.rated || rating ? (
        <p className="font-medium">Merci pour votre avis !</p>
      ) : (
        <>
          <p className="font-medium">Comment s&apos;est passé cet échange ?</p>
          <div className="mt-2 flex justify-center gap-1" role="radiogroup" aria-label="Votre note">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} étoile${n > 1 ? "s" : ""}`} onClick={() => { setRating(n); void rateSupport(n); }} className="flex size-10 items-center justify-center rounded-lg text-warning transition-transform duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-accent">
                <Star className={cn("size-6", n <= rating ? "fill-current" : "")} aria-hidden="true" />
              </button>
            ))}
          </div>
        </>
      )}
      <button type="button" onClick={begin} disabled={busy} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-accent">
        <MessagesSquare className="size-4" aria-hidden="true" />Nouvelle discussion
      </button>
    </div>
  ) : null;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {open ? (
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 text-sm">
          <span className="inline-flex items-center gap-2 text-muted"><span className="size-2 rounded-full bg-success" aria-hidden="true" />Équipe {brand}</span>
          {confirmEnd ? (
            <span className="flex items-center gap-2">
              <span className="text-muted">Terminer ?</span>
              <button type="button" onClick={() => setConfirmEnd(false)} className="h-9 rounded-lg px-2 font-medium hover:bg-surface-muted">Non</button>
              <button type="button" disabled={busy} onClick={() => start(async () => { await endSupportChat(); setConfirmEnd(false); await poll(); onEnded?.(); })} className="h-9 rounded-lg bg-surface-muted px-3 font-medium hover:bg-border">Oui, terminer</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmEnd(true)} className="h-9 rounded-lg px-2 font-medium text-muted hover:bg-surface-muted hover:text-text">Terminer la discussion</button>
          )}
        </div>
      ) : null}
      <LiveChat
        side="user"
        messages={messages}
        thread={thread}
        poll={poll}
        send={sendSupportMessage}
        typing={supportTyping}
        otherName={`Équipe ${brand}`}
        afterMessages={ended}
        placeholder="Votre message…"
      />
    </div>
  );
}
