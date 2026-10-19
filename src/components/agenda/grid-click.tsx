"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Ban, CalendarPlus } from "lucide-react";

const STEP = 15;
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

type Range = { from: number; to: number; lane: number };

/**
 * Couche cliquable sous les rendez-vous d'une journée.
 * - Clic sur un espace libre : « Rendez-vous » ou « Bloquer », à l'heure cliquée (arrondie au quart d'heure).
 * - Clic maintenu et glissé : sélection de la plage horaire (début → fin), reprise dans le formulaire.
 * Le membre est celui de la colonne où la sélection commence.
 */
export function DayClickLayer({ day, startHour, hourPx, lanes, canManage }: { day: string; startHour: number; hourPx: number; lanes: (string | null)[]; canManage: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ anchor: number; lane: number; y: number; moved: boolean } | null>(null);
  const [sel, setSel] = useState<Range | null>(null);
  const [menu, setMenu] = useState<(Range & { x: number }) | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.querySelector("[role=menu]")?.contains(e.target as Node)) {
        setMenu(null);
        setSel(null);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  if (!canManage) return null;

  const minuteAt = (clientY: number, round: "floor" | "ceil" | "round") => {
    const rect = ref.current!.getBoundingClientRect();
    const raw = ((clientY - rect.top) / hourPx) * 60;
    const snapped = Math[round](raw / STEP) * STEP;
    return Math.min(Math.max(0, snapped), Math.round((rect.height / hourPx) * 60)) + startHour * 60;
  };

  const qs = (r: Range, withEnd: boolean) => {
    const p = new URLSearchParams({ date: day, heure: hhmm(r.from) });
    if (withEnd) p.set("fin", hhmm(r.to));
    const member = lanes[r.lane];
    if (member) p.set("membre", member);
    return p.toString();
  };

  const top = (min: number) => ((min - startHour * 60) / 60) * hourPx;
  const shown = menu ?? sel;
  const laneW = 100 / lanes.length;

  return (
    <div
      ref={ref}
      className="absolute inset-0 cursor-cell touch-pan-y select-none"
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget || e.button !== 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const lane = Math.min(lanes.length - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * lanes.length)));
        const anchor = minuteAt(e.clientY, "floor");
        drag.current = { anchor, lane, y: e.clientY, moved: false };
        setMenu(null);
        setSel({ from: anchor, to: anchor + STEP, lane });
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        if (Math.abs(e.clientY - d.y) > 6) d.moved = true;
        if (!d.moved) return;
        const at = minuteAt(e.clientY, "round");
        setSel(at > d.anchor ? { from: d.anchor, to: Math.max(at, d.anchor + STEP), lane: d.lane } : { from: at, to: d.anchor + STEP, lane: d.lane });
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (!d || !sel) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width - 8);
        // Simple clic : seulement l'heure de début (le formulaire propose la durée habituelle).
        setMenu({ ...(d.moved ? sel : { from: d.anchor, to: d.anchor, lane: d.lane }), x });
        if (!d.moved) setSel(null);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setSel(null);
      }}
    >
      {shown && shown.to > shown.from ? (
        <div
          className="pointer-events-none absolute z-20 rounded-md border-2 border-accent bg-accent-soft/80 px-1.5 py-1 text-xs font-semibold text-accent-soft-foreground"
          style={{ top: top(shown.from), height: Math.max(top(shown.to) - top(shown.from), 12), left: `calc(${shown.lane * laneW}% + 2px)`, width: `calc(${laneW}% - 4px)` }}
          aria-hidden="true"
        >
          {hhmm(shown.from)} – {hhmm(shown.to)}
        </div>
      ) : null}
      {menu ? (
        <div
          className="absolute z-30 w-48 overflow-hidden rounded-lg border border-border bg-surface text-sm shadow-lg"
          style={{ top: top(menu.to > menu.from ? menu.to : menu.from) + 4, left: Math.max(0, menu.x - 96) }}
          role="menu"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <p className="border-b border-border px-3 py-2 text-xs font-medium text-muted">
            {menu.to > menu.from ? `${hhmm(menu.from)} – ${hhmm(menu.to)} · ${menu.to - menu.from} min` : hhmm(menu.from)}
          </p>
          <Link href={`/app/agenda/nouveau?${qs(menu, menu.to > menu.from)}`} className="flex items-center gap-2 px-3 py-2.5 hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none" role="menuitem">
            <CalendarPlus className="size-4 text-accent" aria-hidden="true" />
            Rendez-vous
          </Link>
          <Link href={`/app/agenda/bloquer?${qs(menu, menu.to > menu.from)}`} className="flex items-center gap-2 px-3 py-2.5 hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none" role="menuitem">
            <Ban className="size-4 text-muted" aria-hidden="true" />
            Bloquer ce créneau
          </Link>
        </div>
      ) : null}
    </div>
  );
}
