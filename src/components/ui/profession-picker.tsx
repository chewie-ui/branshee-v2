"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/** Métiers les plus courants : proposés en premier quand plusieurs commencent pareil (« kine » → Kinésithérapeute). */
const COMMON = ["Kinésithérapeute", "Médecin généraliste", "Coiffeur / Coiffeuse", "Ostéopathe", "Dentiste", "Psychologue", "Esthéticienne", "Infirmier / Infirmière", "Logopède", "Plombier", "Électricien", "Restaurant", "Garagiste / Mécanicien auto", "Coach sportif / Personal trainer"];
const rank = (o: string) => {
  const i = COMMON.indexOf(o);
  return i < 0 ? COMMON.length : i;
};
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Choix obligatoire d'un métier dans la liste : champ de recherche (accents et majuscules ignorés, « kine » trouve
 * « Kinésithérapeute ») et liste déroulante. La valeur envoyée (champ caché `name`) est toujours un métier de la liste.
 */
export function ProfessionPicker({ id, name, options, defaultValue = "", value: controlled, onChange, invalid, placeholder = "Tapez pour chercher : kiné, coiffeur, plombier…", onEnter }: { id: string; name: string; options: string[]; defaultValue?: string; value?: string; onChange?: (v: string) => void; invalid?: boolean; placeholder?: string; onEnter?: () => void }) {
  const listId = useId();
  const initial = options.find((o) => norm(o) === norm(controlled ?? defaultValue)) ?? "";
  const [selected, setSelected] = useState(initial);
  const value = controlled !== undefined ? (options.find((o) => norm(o) === norm(controlled)) ?? "") : selected;
  const [query, setQuery] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const matches = useMemo(() => {
    const q = norm(query);
    if (!q || q === norm(value)) return options;
    const starts = options.filter((o) => norm(o).split(/[ /(-]+/).some((w) => w.startsWith(q))).sort((a, b) => rank(a) - rank(b));
    const rest = options.filter((o) => !starts.includes(o) && norm(o).includes(q));
    return [...starts, ...rest];
  }, [query, options, value]);
  const pick = (o: string) => {
    setSelected(o);
    setQuery(o);
    setOpen(false);
    onChange?.(o);
  };
  const scrollTo = (i: number) => listRef.current?.children[i]?.scrollIntoView({ block: "nearest" });
  const typedButNotPicked = !open && query.trim() !== "" && norm(query) !== norm(value);
  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={invalid || typedButNotPicked || undefined}
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
            if (value && norm(e.target.value) !== norm(value)) {
              setSelected("");
              onChange?.("");
            }
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              const n = Math.min(active + 1, matches.length - 1);
              setActive(n);
              scrollTo(n);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              const n = Math.max(active - 1, 0);
              setActive(n);
              scrollTo(n);
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (open && matches[active]) pick(matches[active]!);
              else if (value) onEnter?.();
            } else if (e.key === "Escape") setOpen(false);
          }}
          className={cn("h-11 w-full rounded-lg border border-border-strong bg-surface pr-10 pl-3 text-base text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-sm", (invalid || typedButNotPicked) && "border-danger")}
        />
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      </div>
      {open ? (
        <ul ref={listRef} id={listId} role="listbox" className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-muted">Aucun métier ne correspond. Essayez un autre mot, ou choisissez « Autre ».</li>
          ) : (
            matches.map((o, i) => (
              <li
                key={o}
                role="option"
                aria-selected={o === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn("flex min-h-10 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm", i === active ? "bg-surface-muted" : "", o === value ? "font-medium" : "")}
              >
                {o}
                {o === value ? <Check className="size-4 text-accent" aria-hidden="true" /> : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
      {typedButNotPicked ? <p className="mt-1.5 text-sm text-danger" role="alert">Choisissez un métier dans la liste.</p> : null}
    </div>
  );
}
