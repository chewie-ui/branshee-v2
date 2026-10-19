"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { Clock, MessageSquareText, Phone, Tag, UserRound } from "lucide-react";

export type EventSummary = {
  title: string;
  time: string;
  kindLabel: string | null;
  service: string | null;
  member: string | null;
  phone: string | null;
  note: string | null;
  status: string | null;
  color: string;
};

const CARD_W = 264;

/**
 * Rendez-vous de l'agenda : au survol (ou au focus clavier), un petit panneau résume le RDV sans l'ouvrir.
 * Le panneau est en position fixe : il n'est jamais coupé par le défilement de la grille.
 */
export function EventLink({ href, className, style, summary, children }: { href: string; className: string; style: CSSProperties; summary: EventSummary; children: ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const id = useId();

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const roomRight = window.innerWidth - r.right;
      const left = roomRight >= CARD_W + 16 ? r.right + 8 : Math.max(8, r.left - CARD_W - 8);
      const top = Math.min(Math.max(8, r.top), window.innerHeight - 220);
      setPos({ top, left });
    }, 220);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setPos(null);
  };

  useEffect(() => {
    if (!pos) return;
    const onScroll = () => setPos(null);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [pos]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const s = summary;
  return (
    <>
      <Link ref={ref} href={href} className={className} style={style} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} aria-describedby={pos ? id : undefined}>
        {children}
      </Link>
      {pos ? (
        <div id={id} role="tooltip" className="pointer-events-none fixed z-50 rounded-lg border border-border bg-surface p-3 text-sm shadow-lg" style={{ top: pos.top, left: pos.left, width: CARD_W }}>
          <div className="flex items-start gap-2">
            <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-semibold leading-snug break-words">{s.title}</p>
              {s.kindLabel || s.status ? <p className="text-xs text-muted">{[s.kindLabel, s.status].filter(Boolean).join(" · ")}</p> : null}
            </div>
          </div>
          <dl className="mt-2 space-y-1.5 text-muted">
            <Row icon={<Clock className="size-3.5" aria-hidden="true" />} label="Horaire" value={s.time} />
            {s.service ? <Row icon={<Tag className="size-3.5" aria-hidden="true" />} label="Prestation" value={s.service} /> : null}
            {s.member ? <Row icon={<UserRound className="size-3.5" aria-hidden="true" />} label="Praticien" value={s.member} /> : null}
            {s.phone ? <Row icon={<Phone className="size-3.5" aria-hidden="true" />} label="Téléphone" value={s.phone} /> : null}
            {s.note ? <Row icon={<MessageSquareText className="size-3.5" aria-hidden="true" />} label="Note" value={s.note.length > 140 ? `${s.note.slice(0, 140)}…` : s.note} /> : null}
          </dl>
          <p className="mt-2 border-t border-border pt-2 text-xs text-muted">Cliquez pour ouvrir</p>
        </div>
      ) : null}
    </>
  );
}

function Row({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="mt-0.5 shrink-0">
        {icon}
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="min-w-0 break-words text-text">{value}</dd>
    </div>
  );
}
