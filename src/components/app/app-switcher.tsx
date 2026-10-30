"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Pin, Search } from "lucide-react";
import { AppIcon } from "@/components/apps/app-icon";
import type { AppIcon as AppIconName } from "@/lib/apps";
import { cn } from "@/lib/cn";

type SwitchApp = { id: string; name: string; icon: AppIconName; href: string; fav?: boolean; nav: { href: string; label: string; soon?: boolean }[] };
type Entry = { key: string; href: string; label: string; sub: string | null; icon: AppIconName; fav: boolean };

export const openSwitcher = () => window.dispatchEvent(new Event("sky:switcher"));
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * « Aller à… » (Ctrl+K ou ⌘K) : passer d'une app à l'autre, ou directement à une page (Factures › Devis),
 * en tapant quelques lettres. Les apps épinglées sont en tête.
 */
export function AppSwitcher({ apps }: { apps: SwitchApp[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const show = () => { lastFocus.current = document.activeElement as HTMLElement | null; setQ(""); setSel(0); setOpen(true); };
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); show(); }
    };
    window.addEventListener("sky:switcher", show);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("sky:switcher", show); window.removeEventListener("keydown", key); };
  }, []);
  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 0);
  }, [open]);

  const all = useMemo<Entry[]>(() => {
    const sorted = [...apps].sort((a, b) => Number(!!b.fav) - Number(!!a.fav));
    const appsE = sorted.map((a) => ({ key: a.id, href: a.href, label: a.name, sub: null, icon: a.icon, fav: !!a.fav }));
    const pages = sorted.flatMap((a) => a.nav.filter((n) => !n.soon && n.href !== a.href && n.label !== a.name).map((n) => ({ key: `${a.id}:${n.href}`, href: n.href, label: n.label, sub: a.name, icon: a.icon, fav: false })));
    return [...appsE, ...pages];
  }, [apps]);
  const results = useMemo(() => {
    const k = norm(q.trim());
    if (!k) return all.filter((e) => !e.sub);
    return all.filter((e) => norm(`${e.label} ${e.sub ?? ""}`).includes(k)).slice(0, 30);
  }, [all, q]);

  const close = () => { setOpen(false); lastFocus.current?.focus?.(); };
  const go = (e: Entry | undefined) => { if (!e) return; setOpen(false); router.push(e.href); };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Aller à une app">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" onClick={close} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-5 shrink-0 text-muted" aria-hidden="true" />
          <input
            ref={input}
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); go(results[sel]); }
            }}
            placeholder="Aller à… (Clients, Factures, Devis, Fidélité…)"
            aria-label="Rechercher une app ou une page"
            aria-controls="switcher-list"
            aria-activedescendant={results[sel] ? `sw-${sel}` : undefined}
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
            style={{ outline: "none" }}
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-xs text-muted sm:inline">Échap</kbd>
        </div>
        <ul id="switcher-list" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
          {results.length ? results.map((e, i) => (
            <li key={e.key} id={`sw-${i}`} role="option" aria-selected={i === sel}>
              <button type="button" onMouseEnter={() => setSel(i)} onClick={() => go(e)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm", i === sel ? "bg-accent-soft text-accent-soft-foreground" : "hover:bg-surface-muted")}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><AppIcon icon={e.icon} className="size-4" /></span>
                <span className="min-w-0 flex-1 truncate">{e.sub ? <><span className="text-muted">{e.sub} › </span>{e.label}</> : <span className="font-medium">{e.label}</span>}</span>
                {e.fav ? <Pin className="size-3.5 shrink-0 fill-current text-accent" aria-label="Épinglée" /> : null}
                {i === sel ? <ArrowRight className="size-4 shrink-0" aria-hidden="true" /> : null}
              </button>
            </li>
          )) : <li className="px-3 py-6 text-center text-sm text-muted">Aucune app ni page ne correspond.</li>}
        </ul>
        <p className="border-t border-border px-4 py-2 text-xs text-muted">Astuce : <kbd className="rounded border border-border px-1">Ctrl</kbd> + <kbd className="rounded border border-border px-1">K</kbd> depuis n&apos;importe quelle page.</p>
      </div>
    </div>
  );
}
