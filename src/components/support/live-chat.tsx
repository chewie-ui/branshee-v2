"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SupportLive, SupportMessageView, SupportThreadView } from "@/server/support";

type Side = "user" | "admin";
type Pending = { tempId: string; body: string; preview: string | null; status: "sending" | "failed"; error?: string; serverId?: string };

const time = (iso: string) => new Date(iso).toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" });
const isEndNote = (m: SupportMessageView) => m.kind === "system" && m.body.startsWith("Discussion terminée");

/**
 * Discussion en direct (pro ↔ équipe) : rafraîchie toutes les 2,5 s quand elle est à l'écran,
 * message affiché aussitôt envoyé, image jointe (bouton ou coller), « … écrit » et « Vu ».
 */
export function useLiveChat(pollUrl: string, initial?: SupportLive | null) {
  const [messages, setMessages] = useState<SupportMessageView[]>(initial?.messages ?? []);
  const [thread, setThread] = useState<SupportThreadView | null>(initial?.thread ?? null);
  const [loaded, setLoaded] = useState(!!initial);
  const last = useRef<string | null>(initial?.messages.at(-1)?.createdAt ?? null);
  const busy = useRef(false);

  const poll = useCallback(async (full = false) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const visible = document.visibilityState === "visible";
      const qs = new URLSearchParams({ read: visible ? "1" : "0" });
      if (!full && last.current) qs.set("since", last.current);
      const r = await fetch(`${pollUrl}${pollUrl.includes("?") ? "&" : "?"}${qs}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as SupportLive;
      setThread(d.thread);
      setMessages((prev) => {
        if (full) return d.messages;
        if (!d.messages.length) return prev;
        const seen = new Set(prev.map((m) => m.id));
        const add = d.messages.filter((m) => !seen.has(m.id));
        return add.length ? [...prev, ...add] : prev;
      });
      const newest = d.messages.at(-1)?.createdAt;
      if (newest && (!last.current || newest > last.current)) last.current = newest;
      setLoaded(true);
    } catch {
      /* hors ligne : on réessaie au prochain tour */
    } finally {
      busy.current = false;
    }
  }, [pollUrl]);

  useEffect(() => {
    let stop = false;
    let timer = 0;
    const loop = async (first: boolean) => {
      await poll(first && !initial);
      if (stop) return;
      timer = window.setTimeout(() => loop(false), document.visibilityState === "visible" ? 2500 : 15000);
    };
    void loop(true);
    const onVis = () => document.visibilityState === "visible" && void poll();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [poll, initial]);

  return { messages, thread, loaded, poll };
}

export function LiveChat({
  side,
  messages,
  thread,
  poll,
  send,
  typing,
  otherName,
  intro,
  afterMessages,
  placeholder,
  className,
}: {
  side: Side;
  messages: SupportMessageView[];
  thread: SupportThreadView | null;
  poll: () => Promise<void>;
  send: (fd: FormData) => Promise<{ ok: boolean; error?: string; id?: string }>;
  typing: () => Promise<void>;
  otherName: string;
  intro?: ReactNode;
  afterMessages?: ReactNode;
  placeholder: string;
  className?: string;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const lastPing = useRef(0);
  const stick = useRef(true);

  // Les messages envoyés quittent la file dès que le serveur les renvoie.
  const ids = new Set(messages.map((m) => m.id));
  const shown = pending.filter((p) => !p.serverId || !ids.has(p.serverId));

  const count = messages.length + shown.length + (thread?.otherTyping ? 1 : 0);
  useEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [count]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pickFile = (f: File | null) => {
    setError(null);
    if (f && !f.type.startsWith("image/")) return setError("Seules les images sont acceptées.");
    if (f && f.size > 8 * 1024 * 1024) return setError("Image trop lourde (8 Mo maximum).");
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body && !file) return;
    const tempId = `tmp-${Date.now()}`;
    const fd = new FormData();
    fd.set("body", body);
    if (file) fd.set("image", file);
    setPending((p) => [...p, { tempId, body, preview: file ? URL.createObjectURL(file) : null, status: "sending" }]);
    setText("");
    pickFile(null);
    stick.current = true;
    area.current?.focus();
    void send(fd).then(async (r) => {
      setPending((p) => p.map((x) => (x.tempId === tempId ? (r.ok ? { ...x, serverId: r.id } : { ...x, status: "failed", error: r.error }) : x)));
      if (r.ok) await poll();
    });
  }

  const own = (m: SupportMessageView) => m.sender === side && m.kind === "message";
  const lastOwn = [...messages].reverse().find(own);
  const seen = !!lastOwn && !!thread?.otherReadAt && thread.otherReadAt >= lastOwn.createdAt;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        {intro}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || day(prev.createdAt) !== day(m.createdAt);
          return (
            <div key={m.id}>
              {newDay ? <p className="py-2 text-center text-xs text-muted first-letter:uppercase">{day(m.createdAt)}</p> : null}
              {isEndNote(m) ? (
                <p className="flex items-center gap-3 py-2 text-xs text-muted before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">{m.body}</p>
              ) : (
                <Bubble mine={own(m)} name={m.sender !== side ? otherName : null} body={m.body} image={m.image ? `/api/support/image/${m.id}` : null} at={time(m.createdAt)} />
              )}
              {m === lastOwn ? <p className="mt-0.5 pr-1 text-right text-[11px] text-muted">{seen ? "Vu" : "Envoyé"}</p> : null}
            </div>
          );
        })}
        {shown.map((p) => (
          <div key={p.tempId}>
            <Bubble mine name={null} body={p.body} image={p.preview} at={p.status === "sending" ? "Envoi…" : "Non envoyé"} faded={p.status === "sending"} />
            {p.status === "failed" ? (
              <p className="mt-0.5 text-right text-xs text-danger" role="alert">
                {p.error ?? "Envoi impossible."}{" "}
                <button type="button" className="font-medium underline" onClick={() => { setText(p.body); setPending((x) => x.filter((y) => y.tempId !== p.tempId)); }}>Réessayer</button>
              </p>
            ) : null}
          </div>
        ))}
        {thread?.otherTyping ? (
          <div className="flex justify-start" aria-label={`${otherName} est en train d'écrire`}>
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-surface-muted px-4 py-3" aria-hidden="true">
              {[0, 150, 300].map((d) => <span key={d} className="size-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d}ms` }} />)}
            </div>
          </div>
        ) : null}
        {afterMessages}
      </div>

      <form onSubmit={submit} className="border-t border-border p-3">
        {preview ? (
          <div className="relative mb-2 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Image jointe" className="h-20 rounded-lg border border-border object-cover" />
            <button type="button" onClick={() => pickFile(null)} className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-text text-surface shadow" aria-label="Retirer l'image">
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" tabIndex={-1} onChange={(e) => { pickFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          <button type="button" onClick={() => fileInput.current?.click()} className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border text-muted transition-colors duration-150 hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-accent" aria-label="Joindre une image">
            <ImagePlus className="size-5" aria-hidden="true" />
          </button>
          <label htmlFor={`chat-${side}`} className="sr-only">{placeholder}</label>
          <textarea
            ref={area}
            id={`chat-${side}`}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const now = Date.now();
              if (e.target.value && now - lastPing.current > 3000) {
                lastPing.current = now;
                void typing().catch(() => {});
              }
            }}
            onPaste={(e) => {
              const img = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
              if (img) {
                e.preventDefault();
                pickFile(img);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder={placeholder}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2.5 text-base placeholder:text-muted focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/30 sm:text-sm"
          />
          <button type="submit" disabled={!text.trim() && !file} className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50" aria-label="Envoyer">
            {shown.some((p) => p.status === "sending") ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-danger" role="alert">{error}</p> : null}
      </form>
    </div>
  );
}

function Bubble({ mine, name, body, image, at, faded }: { mine: boolean; name: string | null; body: string; image: string | null; at: string; faded?: boolean }) {
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm", mine ? "rounded-br-sm bg-accent text-accent-foreground" : "rounded-bl-sm bg-surface-muted text-text", faded && "opacity-70")}>
        {name ? <p className="mb-0.5 text-xs font-semibold text-accent">{name}</p> : null}
        {image ? (
          <a href={image} target="_blank" rel="noopener" className="mb-1 block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Image envoyée" className="max-h-60 rounded-lg object-contain" />
          </a>
        ) : null}
        {body ? <p className="whitespace-pre-line break-words">{body}</p> : null}
        <p className={cn("mt-1 text-[11px]", mine ? "text-accent-foreground/75" : "text-muted")}>{at}</p>
      </div>
    </div>
  );
}
