"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Ban, CalendarPlus } from "lucide-react";

/**
 * Couche cliquable sous les rendez-vous d'une journée : un clic sur un espace libre propose
 * « Rendez-vous » ou « Bloquer », pré-remplis à l'heure (arrondie au quart d'heure) et au membre de la colonne.
 */
export function DayClickLayer({ day, startHour, hourPx, lanes, canManage }: { day: string; startHour: number; hourPx: number; lanes: (string | null)[]; canManage: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; time: string; member: string | null } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  if (!canManage) return null;

  const qs = (member: string | null, time: string) => {
    const p = new URLSearchParams({ date: day, heure: time });
    if (member) p.set("membre", member);
    return p.toString();
  };

  return (
    <div
      ref={ref}
      className="absolute inset-0 cursor-cell"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;
        const minutes = Math.max(0, Math.round(((y / hourPx) * 60) / 15) * 15) + startHour * 60;
        const time = `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
        const lane = Math.min(lanes.length - 1, Math.max(0, Math.floor((x / rect.width) * lanes.length)));
        setMenu({ x: Math.min(x, rect.width - 8), y, time, member: lanes[lane] ?? null });
      }}
    >
      {menu ? (
        <div className="absolute z-30 w-44 overflow-hidden rounded-lg border border-border bg-surface text-sm shadow-lg" style={{ top: menu.y, left: Math.max(0, menu.x - 88) }} role="menu">
          <p className="border-b border-border px-3 py-2 text-xs font-medium text-muted">{menu.time}</p>
          <Link href={`/app/agenda/nouveau?${qs(menu.member, menu.time)}`} className="flex items-center gap-2 px-3 py-2 hover:bg-surface-muted" role="menuitem">
            <CalendarPlus className="size-4 text-accent" aria-hidden="true" />
            Rendez-vous
          </Link>
          <Link href={`/app/agenda/bloquer?${qs(menu.member, menu.time)}`} className="flex items-center gap-2 px-3 py-2 hover:bg-surface-muted" role="menuitem">
            <Ban className="size-4 text-muted" aria-hidden="true" />
            Bloquer ce créneau
          </Link>
        </div>
      ) : null}
    </div>
  );
}
