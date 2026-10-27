"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ChefHat, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { MAX_QTY, eur } from "@/lib/orders";
import { placeTableOrder } from "@/server/actions/table-order";
import type { MenuCategoryView, MenuItemView } from "@/server/orders";

type Cart = Record<string, { qty: number; note: string }>;
const KEY = (token: string) => `sky-cart-${token}`;

/** Carte côté client (téléphone) : choix des plats, panier, envoi et suivi de la commande. */
export function TableMenu({ token, businessName, photoUrl, tableLabel, categories, items }: { token: string; businessName: string; photoUrl: string | null; tableLabel: string; categories: MenuCategoryView[]; items: MenuItemView[] }) {
  const [cart, setCart] = useState<Cart>({});
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ number: number; track: string } | null>(null);
  const [pending, start] = useTransition();

  // Panier gardé si on recharge la page (navigateur du client uniquement, lu après l'hydratation).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = localStorage.getItem(KEY(token));
      if (raw) setCart(JSON.parse(raw));
      const track = localStorage.getItem(`${KEY(token)}-track`);
      if (track) setSent(JSON.parse(track));
    } catch {}
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [token]);
  useEffect(() => {
    try { localStorage.setItem(KEY(token), JSON.stringify(cart)); } catch {}
  }, [cart, token]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const lines = Object.entries(cart).filter(([id, l]) => l.qty > 0 && byId.has(id));
  const count = lines.reduce((a, [, l]) => a + l.qty, 0);
  const total = lines.reduce((a, [id, l]) => a + byId.get(id)!.priceCents * l.qty, 0);
  const add = (id: string, d: number) => setCart((c) => ({ ...c, [id]: { qty: Math.max(0, Math.min(MAX_QTY, (c[id]?.qty ?? 0) + d)), note: c[id]?.note ?? "" } }));
  const groups = [...categories.map((c) => ({ id: c.id, name: c.name, items: items.filter((i) => i.categoryId === c.id) })), { id: "autres", name: categories.length ? "Autres" : "La carte", items: items.filter((i) => !i.categoryId || !categories.some((c) => c.id === i.categoryId)) }].filter((g) => g.items.length);

  const send = () =>
    start(async () => {
      setError(null);
      const r = await placeTableOrder({ token, lines: lines.map(([itemId, l]) => ({ itemId, qty: l.qty, note: l.note || undefined })), name, note }).catch(() => ({ ok: false as const, error: "Envoi impossible. Vérifiez votre connexion et réessayez." }));
      if (!r.ok) return setError(r.error);
      const s = { number: r.number, track: r.track };
      setSent(s);
      setCart({});
      setOpen(false);
      try { localStorage.setItem(`${KEY(token)}-track`, JSON.stringify(s)); } catch {}
    });

  if (sent) return <Tracking businessName={businessName} tableLabel={tableLabel} sent={sent} onNew={() => { setSent(null); try { localStorage.removeItem(`${KEY(token)}-track`); } catch {} }} />;

  return (
    <div className="min-h-dvh bg-bg pb-28">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="size-12 rounded-xl object-cover" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-xl bg-accent-soft text-accent" aria-hidden="true"><ChefHat className="size-6" /></span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{businessName}</h1>
            <p className="text-sm text-muted">{tableLabel} · commandez depuis votre téléphone</p>
          </div>
        </div>
        {groups.length > 1 ? (
          <nav aria-label="Rubriques" className="mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 pb-3">
            {groups.map((g) => <a key={g.id} href={`#r-${g.id}`} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm hover:border-accent">{g.name}</a>)}
          </nav>
        ) : null}
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-4 py-6">
        {groups.length === 0 ? <p className="py-16 text-center text-muted">La carte n&apos;est pas encore disponible. Demandez au personnel.</p> : null}
        {groups.map((g) => (
          <section key={g.id} id={`r-${g.id}`} aria-labelledby={`h-${g.id}`} className="scroll-mt-4">
            <h2 id={`h-${g.id}`} className="mb-3 text-base font-semibold">{g.name}</h2>
            <ul className="space-y-3">
              {g.items.map((it) => {
                const q = cart[it.id]?.qty ?? 0;
                return (
                  <li key={it.id} className={cn("flex gap-3 rounded-xl border bg-surface p-3", q ? "border-accent" : "border-border")}>
                    {it.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.photoUrl} alt="" className="size-20 shrink-0 rounded-lg object-cover" loading="lazy" />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{it.name}</p>
                      {it.description ? <p className="mt-0.5 text-sm text-muted">{it.description}</p> : null}
                      {it.tags ? <p className="mt-1 text-xs text-muted">{it.tags}</p> : null}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="font-semibold tabular-nums">{eur(it.priceCents)}</span>
                        {q ? (
                          <span className="inline-flex items-center rounded-full border border-border-strong">
                            <button type="button" onClick={() => add(it.id, -1)} className="flex size-11 items-center justify-center" aria-label={`Un ${it.name} de moins`}><Minus className="size-4" aria-hidden="true" /></button>
                            <span className="w-6 text-center font-semibold tabular-nums" aria-live="polite">{q}</span>
                            <button type="button" onClick={() => add(it.id, 1)} className="flex size-11 items-center justify-center" aria-label={`Un ${it.name} de plus`}><Plus className="size-4" aria-hidden="true" /></button>
                          </span>
                        ) : (
                          <button type="button" onClick={() => add(it.id, 1)} className="inline-flex h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" aria-label={`Ajouter ${it.name}`}>
                            <Plus className="size-4" aria-hidden="true" />Ajouter
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>

      {count ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 p-3 backdrop-blur">
          <button type="button" onClick={() => setOpen(true)} className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between rounded-xl bg-accent px-5 font-semibold text-accent-foreground hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <span className="flex items-center gap-2"><ShoppingBag className="size-5" aria-hidden="true" />Voir ma commande ({count})</span>
            <span className="tabular-nums">{eur(total)}</span>
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="cart-title">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Fermer" tabIndex={-1} onClick={() => setOpen(false)} />
          <div className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="cart-title" className="text-lg font-semibold">Ma commande · {tableLabel}</h2>
              <button type="button" onClick={() => setOpen(false)} className="flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-muted" aria-label="Fermer"><X className="size-5" aria-hidden="true" /></button>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {lines.map(([id, l]) => {
                const it = byId.get(id)!;
                return (
                  <li key={id} className="py-3">
                    <div className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 font-medium">{it.name}</span>
                      <span className="inline-flex items-center rounded-full border border-border-strong">
                        <button type="button" onClick={() => add(id, -1)} className="flex size-10 items-center justify-center" aria-label={`Un ${it.name} de moins`}><Minus className="size-4" aria-hidden="true" /></button>
                        <span className="w-6 text-center tabular-nums">{l.qty}</span>
                        <button type="button" onClick={() => add(id, 1)} className="flex size-10 items-center justify-center" aria-label={`Un ${it.name} de plus`}><Plus className="size-4" aria-hidden="true" /></button>
                      </span>
                      <span className="w-20 text-right tabular-nums">{eur(it.priceCents * l.qty)}</span>
                    </div>
                    <input value={l.note} maxLength={120} onChange={(e) => setCart((c) => ({ ...c, [id]: { ...c[id]!, note: e.target.value } }))} placeholder="Précision (cuisson, sans oignon…)" aria-label={`Précision pour ${it.name}`} className="mt-2 h-10 w-full rounded-lg border border-border px-3 text-sm" />
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 space-y-3">
              <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Votre prénom (facultatif)" aria-label="Votre prénom" className="h-11 w-full rounded-lg border border-border px-3" />
              <textarea value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Un mot pour la cuisine ? (allergie…)" aria-label="Message pour la cuisine" rows={2} className="w-full rounded-lg border border-border px-3 py-2" />
            </div>
            {error ? <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
            <button type="button" onClick={send} disabled={pending} className="mt-4 flex h-14 w-full items-center justify-between rounded-xl bg-accent px-5 font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-60">
              <span>{pending ? "Envoi…" : "Envoyer la commande"}</span>
              <span className="tabular-nums">{eur(total)}</span>
            </button>
            <p className="mt-2 text-center text-xs text-muted">Vous payez au comptoir ou à table, comme d&apos;habitude.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Tracking({ businessName, tableLabel, sent, onNew }: { businessName: string; tableLabel: string; sent: { number: number; track: string }; onNew: () => void }) {
  const [status, setStatus] = useState<{ status: string; label: string } | null>(null);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/commande/${sent.track}`, { cache: "no-store" });
        if (r.ok && !stop) setStatus(await r.json());
      } catch {}
    };
    tick();
    const t = setInterval(tick, 6000);
    return () => { stop = true; clearInterval(t); };
  }, [sent.track]);
  const steps = ["new", "preparing", "ready", "served"];
  const at = Math.max(0, steps.indexOf(status?.status ?? "new"));
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center shadow-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-soft text-success" aria-hidden="true"><Check className="size-7" /></span>
        <p className="mt-4 text-sm text-muted">{businessName} · {tableLabel}</p>
        <h1 className="mt-1 text-2xl font-semibold">Commande n° {sent.number}</h1>
        <p className="mt-2 font-medium" role="status" aria-live="polite">{status?.label ?? "Commande reçue"}</p>
        {status?.status !== "cancelled" ? (
          <ol className="mt-5 flex items-center gap-2" aria-label="Avancement">
            {["Reçue", "En préparation", "Prête", "Servie"].map((s, i) => (
              <li key={s} className="flex flex-1 flex-col items-center gap-1 text-xs">
                <span className={cn("h-1.5 w-full rounded-full", i <= at ? "bg-accent" : "bg-surface-muted")} />
                <span className={i <= at ? "font-medium" : "text-muted"}>{s}</span>
              </li>
            ))}
          </ol>
        ) : null}
        <button type="button" onClick={onNew} className="mt-6 inline-flex h-11 items-center rounded-lg border border-border-strong px-4 text-sm font-medium hover:bg-surface-muted">Commander autre chose</button>
      </div>
    </div>
  );
}
