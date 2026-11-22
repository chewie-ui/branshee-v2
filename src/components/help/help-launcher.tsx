"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronRight, LifeBuoy, MessageCircle, MousePointerClick, Search, X, BookOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import { HELP_GUIDES, guideScore, type HelpGuide } from "@/lib/help-guides";
import { TOURS } from "@/lib/tours";
import { useSpacePath } from "@/lib/use-space-path";
import { useT } from "@/components/app-locale";
import { startTour } from "@/components/app/guided-tour";
import { helpStatus, type HelpStatus } from "@/server/actions/help";

// Écrans plein écran (caisse, cuisine) et le centre d'aide lui-même : pas de bouton par-dessus.
const HIDDEN = ["/app/caisse", "/app/commandes", "/app/aide"];
const KEY = "sky-help-guide";

/**
 * Bouton « Aide » sur toutes les pages de l'app : « Que voulez-vous faire ? », des guides par objectif
 * (cases cochées toutes seules quand c'est fait), des visites guidées, et le support en dernier recours.
 * `raised` : remonté au-dessus du bouton de l'assistant IA quand il est présent.
 */
export function HelpLauncher({ raised = false }: { raised?: boolean }) {
  const t = useT();
  const pathname = useSpacePath();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  // Guide en cours gardé pendant la navigation (rien n'est affiché avant l'ouverture : pas d'écart au rendu serveur).
  const [guideKey, setGuideKey] = useState<string | null>(() => {
    try {
      return typeof window === "undefined" ? null : sessionStorage.getItem(KEY);
    } catch {
      return null;
    }
  });
  const [status, setStatus] = useState<HelpStatus | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const pick = (k: string | null) => {
    setGuideKey(k);
    try {
      if (k) sessionStorage.setItem(KEY, k);
      else sessionStorage.removeItem(KEY);
    } catch {
      /* rien à garder */
    }
  };

  // À chaque ouverture : avancement à jour (une étape vient peut-être d'être faite).
  useEffect(() => {
    if (!open) return;
    let live = true;
    helpStatus().then((s) => live && setStatus(s)).catch(() => live && setStatus({ allowed: HELP_GUIDES.map((g) => g.key), checks: {} }));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      live = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, pathname]);

  const guides = useMemo(() => HELP_GUIDES.filter((g) => !status || status.allowed.includes(g.key)), [status]);
  // Recherche : on garde ce qui correspond le mieux (une question à deux objectifs fait ressortir les deux guides).
  const scored = useMemo(() => {
    const query = q.trim();
    if (!query) return [];
    const inGuides = new Set(guides.flatMap((g) => g.steps.map((s) => s.tour)));
    const all = [
      ...guides.map((g) => ({ item: g as HelpGuide | (typeof TOURS)[number], s: guideScore({ title: t(g.title), desc: t(g.desc), keywords: g.keywords }, query) })),
      ...TOURS.filter((x) => !inGuides.has(x.key)).map((x) => ({ item: x as HelpGuide | (typeof TOURS)[number], s: guideScore({ title: t(x.title), desc: t(x.desc), keywords: "" }, query) })),
    ].filter((x) => x.s > 0);
    const best = Math.max(0, ...all.map((x) => x.s));
    return all.filter((x) => x.s * 2 >= best).sort((a, b) => b.s - a.s);
  }, [q, guides, t]);
  const results = useMemo(() => {
    const query = q.trim();
    if (!query) {
      // Sans recherche : d'abord les guides de la page où l'on se trouve.
      const here = guides.filter((g) => g.paths.some((p) => new RegExp(p).test(pathname)));
      return [...here, ...guides.filter((g) => !here.includes(g))];
    }
    return scored.filter((x) => "keywords" in x.item).map((x) => x.item as HelpGuide);
  }, [q, guides, pathname, scored]);
  // Visites guidées qui ne font pas déjà partie d'un guide, seulement en recherche.
  const tours = useMemo(() => scored.filter((x) => !("keywords" in x.item)).map((x) => x.item as (typeof TOURS)[number]), [scored]);

  if (HIDDEN.some((h) => pathname === h || pathname.startsWith(`${h}/`))) return null;
  const guide = guideKey ? guides.find((g) => g.key === guideKey) : null;
  const close = () => setOpen(false);

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn("fixed right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full border border-border bg-surface px-4 font-medium text-text shadow-lg transition-colors duration-150 hover:border-accent/40 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent print:hidden", raised ? "bottom-20" : "bottom-4")}
          aria-haspopup="dialog"
        >
          <LifeBuoy className="size-5 text-accent" aria-hidden="true" />
          {t("Aide")}
        </button>
      ) : (
        <section role="dialog" aria-modal="false" aria-labelledby="help-title" className="fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] flex-col rounded-t-2xl border border-border bg-surface shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:h-[min(680px,85dvh)] sm:w-[420px] sm:rounded-2xl print:hidden">
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            {guide ? (
              <button type="button" onClick={() => pick(null)} className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-accent" aria-label={t("Retour aux guides")}>
                <ArrowLeft className="size-5" aria-hidden="true" />
              </button>
            ) : (
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-foreground" aria-hidden="true"><LifeBuoy className="size-5" /></span>
            )}
            <h2 id="help-title" className="min-w-0 flex-1 truncate font-semibold">{guide ? t(guide.title) : t("Besoin d'aide ?")}</h2>
            <button type="button" onClick={close} className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-accent" aria-label={t("Fermer l'aide")}>
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {guide ? (
              <GuideView guide={guide} status={status} onLeave={close} />
            ) : (
              <div className="space-y-4 p-4">
                <label className="relative block">
                  <span className="sr-only">{t("Que voulez-vous faire ?")}</span>
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                  <input
                    ref={input}
                    autoFocus
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t("Que voulez-vous faire ? Ex. : rappels, publier ma page…")}
                    className="h-11 w-full rounded-lg border border-border bg-surface pr-3 pl-9 text-base placeholder:text-muted focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent sm:text-sm"
                  />
                </label>
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{q.trim() ? t("Résultats") : t("Guides pas à pas")}</p>
                  {results.length || tours.length ? (
                    <ul className="space-y-2">
                      {results.map((g) => {
                        const checked = g.steps.filter((s) => s.check);
                        const done = status ? checked.filter((s) => status.checks[s.check!]).length : 0;
                        const complete = !!status && checked.length > 0 && done === checked.length;
                        return (
                          <li key={g.key}>
                            <button type="button" onClick={() => pick(g.key)} className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors duration-150 hover:border-accent/40 hover:bg-accent-soft/50 focus-visible:outline-2 focus-visible:outline-accent">
                              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", complete ? "bg-success-soft text-success" : "bg-accent-soft text-accent-soft-foreground")} aria-hidden="true">
                                {complete ? <Check className="size-4" /> : <BookOpen className="size-4" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium">{t(g.title)}</span>
                                <span className="block text-xs text-muted">{status && checked.length ? t("{done} sur {total} fait", { done, total: checked.length }) : t(g.desc)}</span>
                              </span>
                              <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
                            </button>
                          </li>
                        );
                      })}
                      {tours.map((x) => (
                        <li key={x.key}>
                          <button type="button" onClick={() => { startTour(x.key); close(); }} className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors duration-150 hover:border-accent/40 hover:bg-accent-soft/50 focus-visible:outline-2 focus-visible:outline-accent">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-soft-foreground" aria-hidden="true"><MousePointerClick className="size-4" /></span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium">{t(x.title)}</span>
                              <span className="block text-xs text-muted">{t("Visite guidée : on vous montre où cliquer.")}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">{t("Pas de guide pour « {q} ». Écrivez-nous : on vous répond rapidement.", { q: q.trim() })}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-3 text-sm">
            <span className="text-muted">{t("Toujours bloqué ?")}</span>
            <Link href="/app/aide#contact" onClick={close} className="inline-flex min-h-11 items-center gap-1.5 font-medium text-accent hover:text-accent-hover">
              <MessageCircle className="size-4" aria-hidden="true" />{t("Écrire au support")}
            </Link>
            <Link href="/app/aide" onClick={close} className="inline-flex min-h-11 items-center gap-1.5 font-medium text-accent hover:text-accent-hover">
              <BookOpen className="size-4" aria-hidden="true" />{t("Centre d'aide")}
            </Link>
          </footer>
        </section>
      )}
    </>
  );
}

function GuideView({ guide, status, onLeave }: { guide: HelpGuide; status: HelpStatus | null; onLeave: () => void }) {
  const t = useT();
  const checked = guide.steps.filter((s) => s.check);
  const done = status ? checked.filter((s) => status.checks[s.check!]).length : 0;
  const pct = checked.length ? Math.round((done / checked.length) * 100) : 0;
  // Première étape pas encore faite : mise en avant.
  const next = status ? guide.steps.findIndex((s) => s.check && !status.checks[s.check]) : -1;
  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-muted">{t(guide.desc)}</p>
      {checked.length ? (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>{status ? t("{done} sur {total} fait", { done, total: checked.length }) : t("Chargement…")}</span>
            <span className="tabular-nums">{status ? `${pct} %` : ""}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("Avancement")}>
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}
      <ol className="space-y-2">
        {guide.steps.map((s, i) => {
          const ok = !!(s.check && status?.checks[s.check]);
          return (
            <li key={i} className={cn("rounded-xl border p-3", i === next ? "border-accent/50 bg-accent-soft/40" : "border-border")}>
              <div className="flex gap-3">
                <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", ok ? "bg-success text-white" : "border-2 border-border-strong text-muted")} aria-hidden="true">
                  {ok ? <Check className="size-3.5" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", ok && "text-muted")}>
                    {t(s.label)}
                    {ok ? <span className="sr-only"> — {t("fait")}</span> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{t(s.hint)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.tour ? (
                      <button type="button" onClick={() => { startTour(s.tour!); onLeave(); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                        <MousePointerClick className="size-4" aria-hidden="true" />{t("Me montrer")}
                      </button>
                    ) : null}
                    <Link href={s.href} onClick={onLeave} className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent", s.tour ? "border border-border hover:bg-surface-muted" : "bg-accent text-accent-foreground hover:bg-accent-hover")}>
                      {ok ? t("Voir") : t("Y aller")}<ChevronRight className="size-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted">{t("Ce guide reste ouvert ici : rouvrez « Aide » après chaque étape pour voir la suite.")}</p>
    </div>
  );
}
