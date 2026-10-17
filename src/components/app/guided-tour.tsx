"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { tourByKey } from "@/lib/tours";

/**
 * Moteur des visites guidées : met en évidence un élément réel de la page et affiche une bulle.
 * L'état (visite + étape) vit dans sessionStorage pour survivre aux changements de page.
 */
const KEY = "bk_tour";
const EVENT = "bk-tour";

type State = { key: string; step: number };

function write(s: State | null) {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : la visite s'arrête simplement */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Lance une visite (depuis le centre d'aide ou l'écran de bienvenue). */
export function startTour(key: string) {
  write({ key, step: 0 });
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
const snapshot = () => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

function parse(raw: string | null): State | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as State;
    return typeof v?.key === "string" && Number.isInteger(v.step) ? v : null;
  } catch {
    return null;
  }
}

/** Élément à mettre en évidence : le premier sélecteur trouvé et visible ; un champ est encadré avec son libellé. */
function findTarget(selectors: string): HTMLElement | null {
  for (const sel of selectors.split(",").map((s) => s.trim()).filter(Boolean)) {
    let el: HTMLElement | null = null;
    try {
      el = document.querySelector<HTMLElement>(sel);
    } catch {
      continue;
    }
    if (!el) continue;
    // Formulaire replié (<details>) : on le déplie pour montrer le champ.
    const folded = el.closest("details:not([open])");
    if (folded) folded.setAttribute("open", "");
    if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox")) el = el.closest<HTMLElement>("[role=radiogroup], fieldset, label") ?? el;
    else if (el.matches("input, select, textarea")) el = el.closest<HTMLElement>("div:has(> label)") ?? el;
    if (el.getClientRects().length) return el;
  }
  return null;
}

type Box = { top: number; left: number; width: number; height: number };

export function GuidedTour() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const state = parse(raw);
  const tour = state ? tourByKey(state.key) : undefined;
  const step = tour?.steps[state!.step];
  const pathname = usePathname();
  const router = useRouter();
  const [box, setBox] = useState<Box | null>(null);
  const onPage = !!step && new RegExp(step.path).test(pathname);

  // Mauvaise page : on y emmène l'utilisateur quand l'étape le permet.
  useEffect(() => {
    if (step && !onPage && step.go) router.push(step.go);
  }, [step, onPage, router]);

  // Suivi de la position de l'élément (il peut apparaître après un rendu, ou bouger au défilement).
  useEffect(() => {
    if (!step?.target || !onPage) return;
    let scrolled = false;
    let clickEl: HTMLElement | null = null;
    const onClick = () => {
      const cur = parse(snapshot());
      if (cur && tour) write(cur.step + 1 < tour.steps.length ? { key: cur.key, step: cur.step + 1 } : null);
    };
    const tick = () => {
      const el = findTarget(step.target!);
      if (!el) {
        setBox(null);
        return;
      }
      if (!scrolled) {
        scrolled = true;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      if (step.advanceOnClick && clickEl !== el) {
        clickEl?.removeEventListener("click", onClick);
        clickEl = el;
        el.addEventListener("click", onClick);
      }
      const r = el.getBoundingClientRect();
      setBox((b) => (b && b.top === r.top && b.left === r.left && b.width === r.width && b.height === r.height ? b : { top: r.top, left: r.left, width: r.width, height: r.height }));
    };
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 200);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      clickEl?.removeEventListener("click", onClick);
    };
  }, [step, onPage, tour]);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && write(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  if (!state || !tour || !step) return null;
  const index = state.step;
  const last = index === tour.steps.length - 1;
  const shown = onPage && step.target ? box : null;
  const go = (i: number) => write(i < 0 ? state : i >= tour.steps.length ? null : { key: state.key, step: i });

  // Bulle sous l'élément s'il reste de la place, sinon au-dessus ; centrée sans élément.
  const pad = 6;
  const width = 340;
  let bubbleStyle: React.CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  if (shown && typeof window !== "undefined") {
    const below = shown.top + shown.height + pad + 12;
    const left = Math.min(Math.max(12, shown.left), window.innerWidth - Math.min(width, window.innerWidth - 24) - 12);
    bubbleStyle = below + 220 < window.innerHeight ? { left, top: below } : { left, top: Math.max(12, shown.top - pad - 12), transform: "translateY(-100%)" };
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-live="polite">
      {shown ? (
        <div
          className="absolute rounded-xl ring-2 ring-accent transition-all duration-200"
          style={{ top: shown.top - pad, left: shown.left - pad, width: shown.width + pad * 2, height: shown.height + pad * 2, boxShadow: "0 0 0 9999px rgb(15 15 26 / 0.45)" }}
          aria-hidden="true"
        />
      ) : (
        <div className="absolute inset-0 bg-[rgb(15_15_26/0.35)]" aria-hidden="true" />
      )}
      <div role="dialog" aria-label={`Visite guidée : ${tour.title}`} className="pointer-events-auto absolute w-[min(340px,calc(100vw-24px))] rounded-xl border border-border bg-surface p-4 shadow-xl" style={bubbleStyle}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium text-accent">
            {tour.title} · {index + 1}/{tour.steps.length}
          </p>
          <button type="button" onClick={() => write(null)} className="-mt-1 -mr-1 flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-muted hover:text-text" aria-label="Quitter la visite">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <h2 className="mt-1 font-semibold">{step.title}</h2>
        <p className="mt-1 text-sm text-muted">
          {!onPage && !step.go ? "Ouvrez l'élément indiqué à l'étape précédente pour continuer." : step.body}
        </p>
        {onPage && step.target && !shown ? <p className="mt-2 text-xs text-muted">L&apos;élément n&apos;est pas visible ici pour le moment (droits, forfait ou contenu vide) : passez à la suite.</p> : null}
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={() => write(null)} className="text-sm text-muted hover:text-text">
            Passer
          </button>
          <div className="flex gap-2">
            {index > 0 ? (
              <button type="button" onClick={() => go(index - 1)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted">
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                Précédent
              </button>
            ) : null}
            <button type="button" onClick={() => go(index + 1)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground hover:bg-accent-hover">
              {last ? "Terminer" : "Suivant"}
              {!last ? <ArrowRight className="size-3.5" aria-hidden="true" /> : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
