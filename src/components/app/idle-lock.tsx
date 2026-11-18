"use client";

import { useEffect, useRef, useState } from "react";
import { lockSession } from "@/server/actions/auth";

const KEY = "sky_last_activity";

/**
 * Verrouille la session après N minutes sans activité (souris, clavier, toucher), tous onglets confondus.
 * Une minute avant, un bandeau propose de rester connecté.
 */
export function IdleLock({ minutes }: { minutes: number }) {
  const [warn, setWarn] = useState(false);
  const locking = useRef(false);
  useEffect(() => {
    const limit = minutes * 60_000;
    const mark = () => {
      try {
        localStorage.setItem(KEY, String(Date.now()));
      } catch {}
      setWarn(false);
    };
    const last = () => {
      try {
        return Number(localStorage.getItem(KEY)) || Date.now();
      } catch {
        return Date.now();
      }
    };
    let lastMark = 0;
    const onActivity = () => {
      // Pas plus d'une écriture par 5 s.
      if (Date.now() - lastMark > 5000) {
        lastMark = Date.now();
        mark();
      }
    };
    mark();
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"] as const;
    for (const e of events) window.addEventListener(e, onActivity, { passive: true });
    const timer = window.setInterval(() => {
      const idle = Date.now() - last();
      if (idle >= limit && !locking.current) {
        locking.current = true;
        void lockSession(window.location.pathname + window.location.search);
      } else setWarn(idle >= limit - 60_000);
    }, 5000);
    return () => {
      for (const e of events) window.removeEventListener(e, onActivity);
      window.clearInterval(timer);
    };
  }, [minutes]);
  if (!warn) return null;
  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-warning/40 bg-surface p-4 text-sm shadow-lg" role="alertdialog" aria-live="assertive">
      <p className="flex-1">Sans activité, votre session se verrouille dans moins d&apos;une minute pour protéger les dossiers patients.</p>
      <button type="button" className="inline-flex h-11 shrink-0 items-center rounded-lg bg-accent px-4 font-medium text-accent-foreground hover:bg-accent-hover" onClick={() => { try { localStorage.setItem(KEY, String(Date.now())); } catch {} setWarn(false); }}>Rester connecté</button>
    </div>
  );
}
