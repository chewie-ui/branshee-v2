"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Send, Sparkles, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { MAX_TEXT, segments, type ChatTurn } from "@/lib/assistant";
import { askAssistant } from "@/server/actions/assistant";

const IDEAS = ["Qui ne m'a pas encore payé ?", "Combien j'ai vendu ce mois-ci ?", "Prépare un devis pour…", "Qu'est-ce que j'ai aujourd'hui ?"];
// Écrans plein écran (caisse, cuisine) : pas de bouton flottant par-dessus.
const HIDDEN = ["/app/caisse", "/app/commandes"];
const KEY = "sky-assistant";

function Rich({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <p key={i} className={cn(line.trim() ? "" : "h-2")}>
          {segments(line).map((s, k) =>
            s.kind === "link" ? (
              <Link key={k} href={s.href} onClick={onNavigate} className="font-medium text-accent underline underline-offset-2 hover:text-accent-hover">{s.text}</Link>
            ) : s.kind === "bold" ? <strong key={k}>{s.text}</strong> : <span key={k}>{s.text}</span>,
          )}
        </p>
      ))}
    </>
  );
}

/** Assistant IA de Skydev : un panneau de discussion ouvert depuis toutes les apps. */
export function AssistantPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  // La discussion survit à un changement de page (mémoire de l'onglet seulement).
  useEffect(() => { try { const raw = sessionStorage.getItem(KEY); if (raw) setTurns(JSON.parse(raw)); } catch {} }, []); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(turns.slice(-20))); } catch {} }, [turns]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [turns, pending]);
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (HIDDEN.some((p) => pathname.startsWith(p))) return null;

  const send = (q: string) => {
    const question = q.trim().slice(0, MAX_TEXT);
    if (!question || pending) return;
    const next: ChatTurn[] = [...turns, { role: "user", text: question }];
    setTurns(next);
    setText("");
    setError(null);
    start(async () => {
      const r = await askAssistant(next).catch(() => ({ ok: false as const, error: "Envoi impossible. Vérifiez votre connexion." }));
      if (!r.ok) {
        setError(r.error);
        setTurns(next.slice(0, -1));
        setText(question);
        return;
      }
      setTurns([...next, { role: "assistant", text: r.text }]);
    });
  };

  return (
    <>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="fixed right-4 bottom-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-accent px-4 font-medium text-accent-foreground shadow-lg transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent print:hidden">
          <Sparkles className="size-5" aria-hidden="true" />Assistant
        </button>
      ) : null}
      {open ? (
        <section role="dialog" aria-modal="false" aria-labelledby="ai-title" className="fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] flex-col rounded-t-2xl border border-border bg-surface shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:h-[min(640px,85dvh)] sm:w-[400px] sm:rounded-2xl print:hidden">
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Sparkles className="size-5 text-accent" aria-hidden="true" />
            <h2 id="ai-title" className="flex-1 font-semibold">Assistant</h2>
            {turns.length ? <button type="button" onClick={() => { setTurns([]); setError(null); }} className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label="Nouvelle discussion"><Trash2 className="size-4" aria-hidden="true" /></button> : null}
            <button type="button" onClick={() => setOpen(false)} className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label="Fermer l'assistant"><X className="size-5" aria-hidden="true" /></button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm" aria-live="polite">
            {!turns.length ? (
              <div className="space-y-3">
                <p className="text-muted">Posez une question sur votre entreprise, ou demandez de préparer un devis ou une facture. Rien n&apos;est envoyé sans vous.</p>
                <div className="flex flex-wrap gap-2">
                  {IDEAS.map((i) => <button key={i} type="button" onClick={() => (i.endsWith("…") ? (setText(i.slice(0, -1)), input.current?.focus()) : send(i))} className="rounded-full border border-border px-3 py-1.5 text-left hover:border-accent hover:text-accent">{i}</button>)}
                </div>
              </div>
            ) : null}
            {turns.map((t, i) => (
              <div key={i} className={cn("max-w-[90%] space-y-1 rounded-2xl px-3 py-2 leading-relaxed", t.role === "user" ? "ml-auto bg-accent text-accent-foreground" : "bg-surface-muted")}>
                {t.role === "user" ? <p className="whitespace-pre-line">{t.text}</p> : <Rich text={t.text} onNavigate={() => window.innerWidth < 640 && setOpen(false)} />}
              </div>
            ))}
            {pending ? <p className="inline-flex items-center gap-2 rounded-2xl bg-surface-muted px-3 py-2 text-muted" role="status"><span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden="true" />L&apos;assistant cherche…</p> : null}
            {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-danger" role="alert">{error}</p> : null}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <label htmlFor="ai-q" className="sr-only">Votre question</label>
              <textarea id="ai-q" ref={input} rows={1} value={text} maxLength={MAX_TEXT} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} placeholder="Votre question…" className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-base sm:text-sm" />
              <button type="submit" disabled={pending || !text.trim()} className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50" aria-label="Envoyer"><Send className="size-4" aria-hidden="true" /></button>
            </div>
            <p className="mt-2 text-xs text-muted">Réponses générées par une IA (Anthropic) : vérifiez avant d&apos;envoyer un document.</p>
          </form>
        </section>
      ) : null}
    </>
  );
}
