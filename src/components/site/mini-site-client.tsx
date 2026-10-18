"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Menu, X } from "lucide-react";
import { sendSiteContact } from "@/server/actions/site";

/** Calendrier de réservation intégré : la hauteur suit le contenu (message « branshee-resize »). */
export function BookingFrame({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(900);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const d = e.data as { type?: string; height?: number };
      if (d?.type === "branshee-resize" && typeof d.height === "number") setHeight(Math.min(4000, Math.max(400, Math.ceil(d.height))));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  return <iframe ref={ref} src={src} title={title} style={{ height }} className="w-full rounded-[var(--s-radius-sm)] border-0 bg-white" loading="lazy" />;
}

/** Menu mobile du site. */
export function SiteMobileMenu({ links, cta }: { links: { href: string; label: string }[]; cta: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} className="flex size-11 items-center justify-center rounded-lg">
        {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
      </button>
      {open ? (
        <nav className="absolute inset-x-0 top-full border-b border-[var(--s-border)] bg-[var(--s-bg)] px-4 py-3 shadow-lg">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-base font-medium">{l.label}</a>
          ))}
          <a href="#booking" onClick={() => setOpen(false)} className="mt-2 flex h-11 items-center justify-center rounded-[var(--s-radius)] bg-[var(--s-primary)] text-sm font-semibold text-[var(--s-on-primary)]">{cta}</a>
        </nav>
      ) : null}
    </div>
  );
}

/** Formulaire de contact du site (email au professionnel). */
export function SiteContactForm({ businessId, preview }: { businessId: string; preview: boolean }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const input = "h-11 w-full rounded-[var(--s-radius-sm)] border border-[var(--s-border)] bg-[var(--s-surface)] px-3 text-sm text-[var(--s-text)] placeholder:text-[var(--s-muted)] focus-visible:outline-2 focus-visible:outline-[var(--s-primary)]";
  if (msg?.ok) return <p className="rounded-[var(--s-radius-sm)] border border-[var(--s-border)] p-4 text-sm" role="status">{msg.text}</p>;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (preview) return setMsg({ ok: false, text: "Aperçu : le formulaire fonctionnera une fois le site publié." });
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await sendSiteContact(businessId, { name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? ""), message: String(fd.get("message") ?? ""), website: String(fd.get("website") ?? "") });
          setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Message envoyé.") : (r.error ?? "Erreur.") });
        });
      }}
    >
      <label className="block"><span className="sr-only">Nom</span><input name="name" required placeholder="Votre nom" className={input} autoComplete="name" /></label>
      <label className="block"><span className="sr-only">Email</span><input name="email" type="email" required placeholder="Votre email" className={input} autoComplete="email" /></label>
      <label className="block"><span className="sr-only">Message</span><textarea name="message" required rows={4} placeholder="Votre message" className={`${input} h-auto py-2`} /></label>
      <div className="hidden" aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" /></div>
      {msg && !msg.ok ? <p className="text-sm" role="alert">{msg.text}</p> : null}
      <button type="submit" disabled={pending} className="inline-flex h-11 items-center rounded-[var(--s-radius)] bg-[var(--s-primary)] px-5 text-sm font-semibold text-[var(--s-on-primary)] disabled:opacity-60">
        {pending ? "Envoi…" : "Envoyer"}
      </button>
    </form>
  );
}
