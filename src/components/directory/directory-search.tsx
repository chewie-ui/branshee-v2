"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, MapPin, Search, Store } from "lucide-react";

type Item = { kind: "metier" | "pro" | "place"; label: string; value: string; sub?: string; href?: string };

/**
 * Barre « Quoi / Où » de l'annuaire : formulaire GET (fonctionne sans JavaScript), avec des suggestions pendant la frappe
 * (métiers et établissements pour « Quoi », localités et codes postaux pour « Où »).
 */
export function DirectorySearch({ q = "", ou = "", big = false }: { q?: string; ou?: string; metiers?: string[]; villes?: string[]; big?: boolean }) {
  const h = big ? "h-12 sm:h-14 text-base" : "h-11 text-sm";
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} role="search" action="/annuaire" className="grid grid-cols-1 gap-2 rounded-2xl border border-border bg-surface p-2 shadow-sm sm:grid-cols-[1.2fr_1fr_auto]">
      <Suggest name="q" type="quoi" initial={q} label="Quoi : métier, prestation ou nom" placeholder="Coiffeur, kiné, massage, nom…" icon={<Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />} h={h} />
      <Suggest name="ou" type="ou" initial={ou} label="Où : ville ou code postal" placeholder="Ville ou code postal" icon={<MapPin className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />} h={h} onPick={() => formRef.current?.requestSubmit()} />
      <button type="submit" className={`${h} inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 font-medium text-accent-foreground transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:translate-y-px`}>
        <Search className="size-4" aria-hidden="true" />
        Rechercher
      </button>
    </form>
  );
}

function Suggest({ name, type, initial, label, placeholder, icon, h, onPick }: { name: string; type: "quoi" | "ou"; initial: string; label: string; placeholder: string; icon: React.ReactNode; h: string; onPick?: () => void }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(initial);
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current) return;
    const t = value.trim();
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      if (!t) return setItems([]);
      try {
        const r = await fetch(`/api/annuaire/suggestions?type=${type}&q=${encodeURIComponent(t)}`, { signal: ctrl.signal });
        if (!r.ok) return;
        const data = (await r.json()) as { items: Item[] };
        setItems(data.items);
        setActive(-1);
        setOpen(true);
      } catch {
        /* frappe suivante ou hors ligne : pas de suggestion */
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [value, type]);

  const pick = (it: Item) => {
    setOpen(false);
    if (it.href) return router.push(it.href);
    typed.current = false;
    setValue(it.value);
    if (onPick) setTimeout(onPick, 0);
  };

  const show = open && items.length > 0;
  return (
    <div className="relative">
      <label htmlFor={`${id}-in`} className="sr-only">{label}</label>
      {icon}
      <input
        id={`${id}-in`}
        name={name}
        value={value}
        onChange={(e) => {
          typed.current = true;
          setValue(e.target.value);
        }}
        onFocus={() => items.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
          else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(items[active]!); }
          else if (e.key === "Escape") setOpen(false);
        }}
        role="combobox"
        aria-expanded={show}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `${id}-o${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        className={`${h} w-full rounded-xl border border-border-strong bg-surface pr-3 pl-10 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/30`}
      />
      {show ? (
        <ul id={`${id}-list`} role="listbox" aria-label={label} className="absolute top-full right-0 left-0 z-30 mt-1.5 max-h-80 overflow-auto rounded-xl border border-border bg-surface py-1.5 text-left shadow-lg">
          {items.map((it, i) => {
            const Icon = it.kind === "pro" ? Store : it.kind === "place" ? MapPin : Briefcase;
            return (
              <li
                key={`${it.kind}-${it.label}-${i}`}
                id={`${id}-o${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); pick(it); }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-3 px-3.5 py-2.5 text-sm ${i === active ? "bg-surface-muted" : ""}`}
              >
                <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-text">{it.label}</span>
                  {it.sub ? <span className="block truncate text-xs text-muted">{it.sub}</span> : null}
                </span>
                {it.kind === "pro" ? <span className="text-xs text-muted">Voir la page</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
