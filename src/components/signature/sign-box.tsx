"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Eraser, Printer } from "lucide-react";
import { cn } from "@/lib/cn";
import { declineQuote, signQuote } from "@/server/actions/signatures";
import { SignatureSvg } from "./signature-svg";

type State = "open" | "signed" | "declined" | "expired" | "changed";
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);

/** Zone de signature : nom, tracé au doigt ou à la souris, « Bon pour accord ». */
export function SignBox({ token, state, amount, signed }: { token: string; state: State; amount: number; signed: { name: string; at: string; path: string; hash: string } | null }) {
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [path, setPath] = useState("");
  const [refuse, setRefuse] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const svg = useRef<SVGSVGElement>(null);
  const drawing = useRef(false);

  const pt = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return `${Math.round(((e.clientX - r.left) / r.width) * 400)} ${Math.round(((e.clientY - r.top) / r.height) * 160)}`;
  };
  const down = (e: React.PointerEvent) => { e.preventDefault(); svg.current?.setPointerCapture(e.pointerId); drawing.current = true; setPath((p) => `${p} M${pt(e)}`.trim()); };
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const p = pt(e); setPath((s) => (s.length < 38_000 ? `${s} L${p}` : s)); };
  const up = () => { drawing.current = false; };

  if (state === "signed" || done) {
    return (
      <div className="h-fit space-y-3 rounded-xl border border-border bg-surface p-5">
        <p className="flex items-center gap-2 font-semibold text-success"><Check className="size-5" aria-hidden="true" />{done ?? "Devis signé"}</p>
        {signed ? (
          <>
            <SignatureSvg path={signed.path} className="h-24 w-full text-text" />
            <p className="text-sm">Signé par <b>{signed.name}</b> le {new Intl.DateTimeFormat("fr-BE", { dateStyle: "long", timeStyle: "short" }).format(new Date(signed.at))}, « Bon pour accord ».</p>
            <p className="break-all text-xs text-muted">Empreinte du devis : {signed.hash}</p>
          </>
        ) : null}
        <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted print:hidden"><Printer className="size-4" aria-hidden="true" />Imprimer / PDF</button>
      </div>
    );
  }
  if (state !== "open") {
    const text = state === "declined" ? "Vous avez refusé ce devis." : state === "expired" ? "Ce lien a expiré. Demandez un nouveau lien à votre fournisseur." : "Le devis a changé depuis l'envoi. Demandez un nouveau lien à votre fournisseur.";
    return <p className="h-fit rounded-xl border border-border bg-surface p-5 text-sm" role="status">{text}</p>;
  }
  const sign = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(null);
      const r: { ok: boolean; message?: string; error?: string } = await signQuote({ token, name, path, agree: agree as true }).catch(() => ({ ok: false, error: "Envoi impossible. Vérifiez votre connexion." }));
      if (!r.ok) return setError(r.error ?? "Signature impossible.");
      setDone(r.message ?? "Devis signé.");
      setTimeout(() => window.location.reload(), 1200);
    });
  };
  return (
    <div className="h-fit space-y-4 rounded-xl border border-border bg-surface p-5 lg:sticky lg:top-4">
      {refuse ? (
        <form onSubmit={(e) => { e.preventDefault(); start(async () => { const r: { ok: boolean; message?: string; error?: string } = await declineQuote({ token, reason }).catch(() => ({ ok: false, error: "Envoi impossible." })); if (!r.ok) return setError(r.error ?? "Envoi impossible."); window.location.reload(); }); }} className="space-y-3">
          <h2 className="font-semibold">Refuser le devis</h2>
          <label htmlFor="sg-reason" className="block text-sm">Un mot pour votre fournisseur ? (facultatif)</label>
          <textarea id="sg-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
          {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
          <div className="flex gap-2">
            <button type="button" onClick={() => setRefuse(false)} className="h-10 flex-1 rounded-lg border border-border-strong text-sm font-medium hover:bg-surface-muted">Retour</button>
            <button type="submit" disabled={pending} className="h-10 flex-1 rounded-lg bg-danger text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">Refuser</button>
          </div>
        </form>
      ) : (
        <form onSubmit={sign} className="space-y-4" noValidate>
          <div>
            <h2 className="font-semibold">Signer le devis</h2>
            <p className="text-sm text-muted">Montant : <b className="text-text">{eur(amount)} TVAC</b></p>
          </div>
          <div>
            <label htmlFor="sg-name" className="block text-sm font-medium">Votre nom complet</label>
            <input id="sg-name" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} maxLength={120} autoComplete="name" className="mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium" id="sg-pad">Votre signature</p>
              {path ? <button type="button" onClick={() => setPath("")} className="inline-flex items-center gap-1 text-xs text-muted hover:text-text"><Eraser className="size-3.5" aria-hidden="true" />Effacer</button> : null}
            </div>
            <svg ref={svg} viewBox="0 0 400 160" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} aria-labelledby="sg-pad" role="img" className={cn("mt-1 h-36 w-full touch-none rounded-lg border-2 border-dashed bg-surface-muted/40", path ? "border-border-strong" : "border-border")}>
              <path d={path} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="text-text" />
              {!path ? <text x="200" y="85" textAnchor="middle" className="fill-muted text-[14px]">Signez ici avec le doigt ou la souris</text> : null}
            </svg>
          </div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4" /><span><b>Bon pour accord.</b> J&apos;accepte ce devis et ses conditions.</span></label>
          {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
          <button type="submit" disabled={pending} className="h-12 w-full rounded-xl bg-accent font-semibold text-accent-foreground hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60">{pending ? "Signature…" : "Signer le devis"}</button>
          <button type="button" onClick={() => { setError(null); setRefuse(true); }} className="w-full text-sm text-muted hover:text-text">Refuser le devis</button>
          <p className="text-xs text-muted">Signature électronique : votre nom, votre tracé, la date, l&apos;heure et l&apos;adresse de connexion sont enregistrés avec une empreinte du devis.</p>
        </form>
      )}
    </div>
  );
}
