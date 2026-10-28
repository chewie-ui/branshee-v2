"use client";

import { useRef } from "react";
import { Eraser } from "lucide-react";
import { cn } from "@/lib/cn";

/** Cadre de signature au doigt ou à la souris ; renvoie un chemin SVG (cadre 400 × 160). */
export function SignaturePad({ value, onChange, labelId, label }: { value: string; onChange: (path: string) => void; labelId: string; label: string }) {
  const svg = useRef<SVGSVGElement>(null);
  const drawing = useRef(false);
  const pt = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return `${Math.round(((e.clientX - r.left) / r.width) * 400)} ${Math.round(((e.clientY - r.top) / r.height) * 160)}`;
  };
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium" id={labelId}>{label}</p>
        {value ? <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1 text-xs text-muted hover:text-text"><Eraser className="size-3.5" aria-hidden="true" />Effacer</button> : null}
      </div>
      <svg
        ref={svg}
        viewBox="0 0 400 160"
        role="img"
        aria-labelledby={labelId}
        onPointerDown={(e) => { e.preventDefault(); svg.current?.setPointerCapture(e.pointerId); drawing.current = true; onChange(`${value} M${pt(e)}`.trim()); }}
        onPointerMove={(e) => { if (drawing.current && value.length < 38_000) onChange(`${value} L${pt(e)}`); }}
        onPointerUp={() => { drawing.current = false; }}
        onPointerLeave={() => { drawing.current = false; }}
        className={cn("mt-1 h-36 w-full touch-none rounded-lg border-2 border-dashed bg-surface-muted/40", value ? "border-border-strong" : "border-border")}
      >
        <path d={value} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="text-text" />
        {!value ? <text x="200" y="85" textAnchor="middle" className="fill-muted text-[14px]">Signez ici avec le doigt</text> : null}
      </svg>
    </div>
  );
}
