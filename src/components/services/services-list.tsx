"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Columns3, Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatDuration, formatPrice } from "@/lib/time";
import { moveService, setServicesActive } from "@/server/actions/services";

export type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  imageUrl: string | null;
  kind: "individual" | "group";
  capacity: number | null;
  durationMin: number;
  durationMaxMin: number | null;
  priceCents: number | null;
  isActive: boolean;
  categoryId: string | null;
  who: string;
  limitedHours: boolean;
  byAnswers: boolean;
};

type Column = "type" | "who" | "duration" | "price" | "status";
const COLUMNS: { key: Column; label: string }[] = [
  { key: "type", label: "Type" },
  { key: "who", label: "Qui la réalise" },
  { key: "duration", label: "Durée" },
  { key: "price", label: "Prix" },
  { key: "status", label: "Statut" },
];
const STORAGE_KEY = "branshee:services-columns";
function subscribeColumns(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("branshee-columns", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("branshee-columns", cb);
  };
}
function readColumns() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function ServicesList({ rows, categories, canManage }: { rows: ServiceRow[]; categories: { id: string; name: string; icon: string | null }[]; canManage: boolean }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("default");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  // Colonnes masquées : préférence de cet appareil (localStorage), lue sans décalage d'hydratation.
  const hiddenRaw = useSyncExternalStore(subscribeColumns, readColumns, () => "[]");
  const hidden = useMemo<Column[]>(() => {
    try {
      const v = JSON.parse(hiddenRaw);
      return Array.isArray(v) ? v.filter((c) => COLUMNS.some((x) => x.key === c)) : [];
    } catch {
      return [];
    }
  }, [hiddenRaw]);
  const [showCols, setShowCols] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const activate = (ids: string[], active: boolean, after?: () => void) =>
    start(async () => {
      const r = await setServicesActive(ids, active);
      setNotice(r.ok ? null : (r.error ?? null));
      after?.();
    });

  const toggleCol = (c: Column) => {
    const next = hidden.includes(c) ? hidden.filter((x) => x !== c) : [...hidden, c];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event("branshee-columns"));
    } catch {
      /* stockage indisponible */
    }
  };
  const show = (c: Column) => !hidden.includes(c);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    const list = rows.filter((r) => (!q || fold(`${r.name} ${r.description ?? ""}`).includes(q)) && (!type || r.kind === type) && (!status || (status === "active") === r.isActive));
    const by: Record<string, (a: ServiceRow, b: ServiceRow) => number> = {
      "name-asc": (a, b) => a.name.localeCompare(b.name, "fr"),
      "name-desc": (a, b) => b.name.localeCompare(a.name, "fr"),
      "price-asc": (a, b) => (a.priceCents ?? Infinity) - (b.priceCents ?? Infinity),
      "price-desc": (a, b) => (b.priceCents ?? -1) - (a.priceCents ?? -1),
      "duration-asc": (a, b) => a.durationMin - b.durationMin,
      "duration-desc": (a, b) => b.durationMin - a.durationMin,
    };
    return by[sort] ? [...list].sort(by[sort]) : list;
  }, [rows, query, type, status, sort]);

  // L'ordre manuel (flèches) n'a de sens que sur la liste complète, triée par défaut.
  const manualOrder = canManage && sort === "default" && !query && !type && !status;
  const groups = sort === "default"
    ? [...categories.map((c) => ({ key: c.id, name: `${c.icon ? `${c.icon} ` : ""}${c.name}`, items: filtered.filter((r) => r.categoryId === c.id) })), { key: "none", name: categories.length ? "Sans catégorie" : "Toutes les prestations", items: filtered.filter((r) => !r.categoryId || !categories.some((c) => c.id === r.categoryId)) }].filter((g) => g.items.length)
    : [{ key: "all", name: "Résultats", items: filtered }];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une prestation…" className="pl-9" aria-label="Rechercher une prestation" />
        </div>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-auto" aria-label="Trier">
          <option value="default">Ordre de la page</option>
          <option value="name-asc">Nom (A → Z)</option>
          <option value="name-desc">Nom (Z → A)</option>
          <option value="price-asc">Prix croissant</option>
          <option value="price-desc">Prix décroissant</option>
          <option value="duration-asc">Durée courte → longue</option>
          <option value="duration-desc">Durée longue → courte</option>
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-auto" aria-label="Type">
          <option value="">Tous les types</option>
          <option value="individual">Rendez-vous</option>
          <option value="group">Cours collectifs</option>
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto" aria-label="Statut">
          <option value="">Actives et masquées</option>
          <option value="active">Actives</option>
          <option value="hidden">Masquées</option>
        </Select>
        <div className="relative">
          <Button variant="secondary" icon={<Columns3 className="size-4" aria-hidden="true" />} onClick={() => setShowCols((v) => !v)} aria-expanded={showCols}>Colonnes</Button>
          {showCols ? (
            <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-border bg-surface p-2 shadow-lg">
              {COLUMNS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-muted">
                  <input type="checkbox" checked={show(c.key)} onChange={() => toggleCol(c.key)} className="size-4 accent-[var(--accent)]" />
                  {c.label}
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {notice ? <p className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-2.5 text-sm text-warning" role="alert">{notice}</p> : null}
      {canManage && selected.length ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent bg-accent-soft px-4 py-2.5 text-sm">
          <SlidersHorizontal className="size-4 text-accent" aria-hidden="true" />
          <span className="font-medium">{selected.length} sélectionnée{selected.length > 1 ? "s" : ""}</span>
          <button type="button" onClick={() => setSelected([])} className="text-muted hover:text-text">Tout désélectionner</button>
          <span className="ml-auto flex gap-2">
            <Button size="sm" variant="secondary" loading={pending} onClick={() => activate(selected, true, () => setSelected([]))}>Activer</Button>
            <Button size="sm" variant="secondary" loading={pending} onClick={() => activate(selected, false, () => setSelected([]))}>Masquer</Button>
          </span>
        </div>
      ) : null}

      {groups.length === 0 ? (
        <Card><p className="p-6 text-center text-sm text-muted">Aucune prestation ne correspond.</p></Card>
      ) : (
        groups.map((g) => (
          <Card key={g.key} className="overflow-hidden">
            <h2 className="border-b border-border bg-surface-muted px-5 py-2.5 text-sm font-semibold">{g.name}</h2>
            <ul className="divide-y divide-border">
              {g.items.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  {canManage ? <input type="checkbox" checked={selected.includes(s.id)} onChange={() => setSelected((l) => (l.includes(s.id) ? l.filter((x) => x !== s.id) : [...l, s.id]))} className="size-4 shrink-0 accent-[var(--accent)]" aria-label={`Sélectionner ${s.name}`} /> : null}
                  {s.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.imageUrl} alt="" className="hidden size-10 shrink-0 rounded-md object-cover sm:block" />
                  ) : (
                    <span className="hidden size-3 shrink-0 rounded-full sm:block" style={{ background: s.color ?? "var(--accent)" }} aria-hidden="true" />
                  )}
                  <Link href={canManage ? `/app/prestations/${s.id}` : "#"} className={cn("min-w-0 flex-1", !canManage && "pointer-events-none")}>
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {s.name}
                      {show("type") && s.kind === "group" ? <Badge tone="accent">Cours collectif{s.capacity ? ` · ${s.capacity} places` : ""}</Badge> : null}
                      {s.limitedHours ? <Badge>Jours et heures limités</Badge> : null}
                      {s.byAnswers ? <Badge>Selon les réponses</Badge> : null}
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-x-4 text-sm text-muted">
                      {show("who") ? <span>{s.who}</span> : null}
                      {show("duration") ? <span className="tabular-nums">{formatDuration(s.durationMin, s.durationMaxMin)}</span> : null}
                      {show("price") ? <span className="font-medium text-text tabular-nums">{formatPrice(s.priceCents)}</span> : null}
                    </p>
                  </Link>
                  {show("status") && canManage ? (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={s.isActive}
                      aria-label={`${s.name} : ${s.isActive ? "réservable en ligne" : "masquée"}`}
                      title={s.isActive ? "Réservable en ligne" : "Masquée de votre page"}
                      disabled={pending}
                      onClick={() => activate([s.id], !s.isActive)}
                      className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", s.isActive ? "bg-accent" : "bg-border-strong")}
                    >
                      <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", s.isActive && "translate-x-4")} />
                    </button>
                  ) : show("status") && !s.isActive ? <Badge>Masquée</Badge> : null}
                  {manualOrder ? (
                    <div className="hidden shrink-0 flex-col sm:flex">
                      <button type="button" disabled={i === 0 || pending} onClick={() => start(async () => void (await moveService(s.id, "up")))} className="flex size-6 items-center justify-center rounded text-muted hover:text-text disabled:opacity-25" aria-label={`Monter ${s.name}`}><ArrowUp className="size-3.5" aria-hidden="true" /></button>
                      <button type="button" disabled={i === g.items.length - 1 || pending} onClick={() => start(async () => void (await moveService(s.id, "down")))} className="flex size-6 items-center justify-center rounded text-muted hover:text-text disabled:opacity-25" aria-label={`Descendre ${s.name}`}><ArrowDown className="size-3.5" aria-hidden="true" /></button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
