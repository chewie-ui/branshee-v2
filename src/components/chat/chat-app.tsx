"use client";

import { Fragment, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Hash, Plus, Send, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/invoicing/confirm-dialog";
import { cn } from "@/lib/cn";
import { chatList, createChannel, deleteChannel, deleteMessage, fetchMessages, openDirect, sendMessage, type ChatMessage } from "@/server/actions/chat";

type Channel = { id: string; kind: string; name: string | null; directKey: string | null; lastMessageAt: string | null; unread: number };
type Member = { id: string; name: string };

/** Découpe un message en texte et liens http(s) cliquables (jamais de HTML). */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"]+)/g);
  return <>{parts.map((p, i) => (i % 2 ? <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline">{p}</a> : <Fragment key={i}>{p}</Fragment>))}</>;
}

/** Messagerie d'équipe : salons, discussions privées, rafraîchissement toutes les 4 secondes. */
export function ChatApp({ initialChannels, team, me, initial, canManage }: { initialChannels: Channel[]; team: Member[]; me: string; initial: string | null; canManage: boolean }) {
  const [channels, setChannels] = useState(initialChannels);
  const [active, setActive] = useState<string | null>(initial);
  const [mobileList, setMobileList] = useState(!initial);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [newCh, setNewCh] = useState<string | null>(null);
  const [delCh, setDelCh] = useState(false);
  const [pending, start] = useTransition();
  const list = useRef<HTMLDivElement>(null);
  const last = useRef<string | null>(null);
  const names = new Map(team.map((m) => [m.id, m.name]));
  const titleOf = (c: Channel) => (c.kind === "direct" ? (names.get(c.directKey?.split(":").find((x) => x !== me) ?? "") ?? "Ancien membre") : (c.name ?? "Salon"));
  const current = channels.find((c) => c.id === active) ?? null;

  const scrollDown = () => requestAnimationFrame(() => list.current?.scrollTo({ top: list.current.scrollHeight }));
  const load = useCallback(async (id: string, fresh: boolean) => {
    const r = await fetchMessages(id, fresh ? null : last.current).catch(() => null);
    if (!r?.ok) return;
    if (fresh) setMessages(r.messages);
    else if (r.messages.length) setMessages((m) => [...m, ...r.messages.filter((x) => !m.some((y) => y.id === x.id))]);
    if (r.messages.length) { last.current = r.messages.at(-1)!.createdAt; scrollDown(); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!active) return;
    last.current = null;
    let stop = false;
    load(active, true).then(() => { setChannels((cs) => cs.map((c) => (c.id === active ? { ...c, unread: 0 } : c))); });
    const t = setInterval(() => { if (!stop && document.visibilityState === "visible") load(active, false); }, 4000);
    return () => { stop = true; clearInterval(t); };
  }, [active, load]);
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const cs = await chatList().catch(() => null);
      if (cs) setChannels(cs.map((c) => (c.id === active ? { ...c, unread: 0 } : c)));
    }, 15000);
    return () => clearInterval(t);
  }, [active]);

  const pick = (id: string) => { setLoading(true); setMessages([]); setActive(id); setMobileList(false); setError(null); window.history.replaceState(null, "", `/app/messagerie?c=${id}`); };
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!active || !text.trim()) return;
    const body = text;
    setText("");
    start(async () => {
      const r = await sendMessage(active, body).catch(() => ({ ok: false as const, error: "Envoi impossible. Vérifiez votre connexion." }));
      if (!r.ok) { setError(r.error); setText(body); return; }
      setError(null);
      await load(active, false);
    });
  };
  const dm = (memberId: string) => start(async () => {
    const r = await openDirect(memberId).catch(() => ({ ok: false as const, error: "Impossible." }));
    if (!r.ok || !r.id) return setError(r.ok ? "Impossible." : r.error);
    const cs = await chatList().catch(() => null);
    if (cs) setChannels(cs);
    pick(r.id);
  });
  const fmt = (iso: string) => {
    const d = new Date(iso);
    const today = new Date().toDateString() === d.toDateString();
    return new Intl.DateTimeFormat("fr-BE", today ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
  };
  const others = team.filter((m) => m.id !== me);
  const directs = channels.filter((c) => c.kind === "direct");

  return (
    <div className="-mx-4 grid h-[72dvh] min-h-[420px] grid-cols-1 overflow-hidden border-border bg-surface sm:mx-0 sm:my-0 sm:h-[calc(100dvh-11rem)] sm:rounded-xl sm:border md:grid-cols-[260px_1fr]">
      <aside className={cn("min-h-0 flex-col overflow-y-auto border-r border-border bg-surface-muted/40 p-3", mobileList ? "flex" : "hidden md:flex")} aria-label="Discussions">
        <div className="flex items-center justify-between px-2 pt-1">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Salons</h2>
          <button type="button" onClick={() => setNewCh("")} className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-text" aria-label="Nouveau salon"><Plus className="size-4" aria-hidden="true" /></button>
        </div>
        {newCh !== null ? (
          <form className="mt-2 flex gap-1 px-1" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await createChannel(newCh); if (!r.ok) return setError(r.error); setNewCh(null); const cs = await chatList(); setChannels(cs); if (r.id) pick(r.id); }); }}>
            <label htmlFor="new-ch" className="sr-only">Nom du salon</label>
            <Input id="new-ch" value={newCh} onChange={(e) => setNewCh(e.target.value)} maxLength={40} autoFocus className="h-9" placeholder="Ex. : chantiers" />
            <Button size="sm" type="submit" className="h-9" disabled={!newCh.trim()}>OK</Button>
          </form>
        ) : null}
        <ul className="mt-1 space-y-0.5">
          {channels.filter((c) => c.kind === "channel").map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => pick(c.id)} aria-current={c.id === active ? "page" : undefined} className={cn("flex h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm", c.id === active ? "bg-surface font-semibold shadow-sm" : "hover:bg-surface")}>
                <Hash className="size-4 shrink-0 text-muted" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{c.name}</span>
                {c.unread ? <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-foreground tabular-nums" aria-label={`${c.unread} non lus`}>{c.unread}</span> : null}
              </button>
            </li>
          ))}
        </ul>
        <h2 className="mt-5 px-2 text-xs font-semibold tracking-wide text-muted uppercase">Messages privés</h2>
        <ul className="mt-1 space-y-0.5">
          {others.length === 0 ? <li className="px-2 py-2 text-xs text-muted">Invitez votre équipe (app Équipe) pour discuter en privé.</li> : null}
          {others.map((m) => {
            const c = directs.find((d) => d.directKey?.split(":").includes(m.id));
            return (
              <li key={m.id}>
                <button type="button" onClick={() => (c ? pick(c.id) : dm(m.id))} aria-current={c && c.id === active ? "page" : undefined} className={cn("flex h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm", c && c.id === active ? "bg-surface font-semibold shadow-sm" : "hover:bg-surface")}>
                  <UserRound className="size-4 shrink-0 text-muted" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{m.name}</span>
                  {c?.unread ? <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-foreground tabular-nums" aria-label={`${c.unread} non lus`}>{c.unread}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className={cn("min-h-0 flex-col", mobileList ? "hidden md:flex" : "flex")} aria-label="Conversation">
        {current ? (
          <>
            <header className="flex items-center gap-2 border-b border-border px-4 py-3">
              <button type="button" onClick={() => setMobileList(true)} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted md:hidden" aria-label="Retour aux discussions"><ArrowLeft className="size-5" aria-hidden="true" /></button>
              {current.kind === "channel" ? <Hash className="size-4 text-muted" aria-hidden="true" /> : <UserRound className="size-4 text-muted" aria-hidden="true" />}
              <h2 className="min-w-0 flex-1 truncate font-semibold">{titleOf(current)}</h2>
              {canManage && current.kind === "channel" && channels.filter((c) => c.kind === "channel").length > 1 ? (
                <button type="button" onClick={() => setDelCh(true)} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger" aria-label="Supprimer le salon"><Trash2 className="size-4" aria-hidden="true" /></button>
              ) : null}
            </header>
            <div ref={list} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
              {loading ? <p className="text-center text-sm text-muted">Chargement…</p> : messages.length === 0 ? <p className="py-10 text-center text-sm text-muted">Aucun message. Écrivez le premier !</p> : null}
              {messages.map((m, i) => {
                const mine = m.memberId === me;
                const grouped = i > 0 && messages[i - 1]!.memberId === m.memberId && Date.parse(m.createdAt) - Date.parse(messages[i - 1]!.createdAt) < 5 * 60_000;
                return (
                  <div key={m.id} className={cn("group flex flex-col", mine ? "items-end" : "items-start", grouped && "-mt-2")}>
                    {!grouped ? <p className="mb-0.5 px-1 text-xs text-muted">{mine ? "Vous" : (m.author ?? "Ancien membre")} · {fmt(m.createdAt)}</p> : null}
                    <div className="flex max-w-[85%] items-center gap-1">
                      {mine && !m.deleted ? <button type="button" onClick={() => start(async () => { const r = await deleteMessage(m.id); if (r.ok) setMessages((ms) => ms.map((x) => (x.id === m.id ? { ...x, deleted: true, body: "" } : x))); })} className="flex size-7 shrink-0 items-center justify-center rounded text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-danger" aria-label="Supprimer ce message"><Trash2 className="size-3.5" aria-hidden="true" /></button> : null}
                      <p className={cn("rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap", m.deleted ? "border border-dashed border-border text-muted italic" : mine ? "bg-accent text-accent-foreground" : "bg-surface-muted")}>{m.deleted ? "Message supprimé" : <Linkified text={m.body} />}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <form onSubmit={send} className="flex items-end gap-2 border-t border-border p-3">
              <label htmlFor="chat-text" className="sr-only">Votre message</label>
              <textarea id="chat-text" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }} rows={1} maxLength={4000} placeholder={`Écrire à ${titleOf(current)}…`} className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-sm focus:outline-2 focus:outline-accent" />
              <Button type="submit" className="h-11" disabled={!text.trim() || pending} aria-label="Envoyer" icon={<Send className="size-4" aria-hidden="true" />}><span className="hidden sm:inline">Envoyer</span></Button>
            </form>
            {error ? <p className="px-3 pb-3 text-sm text-danger" role="alert">{error}</p> : null}
          </>
        ) : <p className="m-auto text-sm text-muted">Choisissez une discussion.</p>}
      </section>
      <ConfirmDialog open={delCh && !!current} title={`Supprimer le salon « ${current?.name ?? ""} » ?`} confirmLabel="Supprimer" danger loading={pending} onCancel={() => setDelCh(false)} onConfirm={() => current && start(async () => { const r = await deleteChannel(current.id); setDelCh(false); if (!r.ok) return setError(r.error); const cs = await chatList(); setChannels(cs); const next = cs.find((c) => c.kind === "channel"); if (next) pick(next.id); })}>
        Tous les messages de ce salon sont supprimés.
      </ConfirmDialog>
    </div>
  );
}
