"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { cancelSignature, requestSignature } from "@/server/actions/signatures";
import { SignatureSvg } from "./signature-svg";

export type SigView = { status: "pending" | "viewed" | "signed" | "declined" | "expired"; email: string; sentAt: string; url: string; signerName: string | null; signedAt: string | null; path: string | null; ip: string | null; hash: string; reason: string | null };

/** Fiche d'un devis : envoyer pour signature, suivre (vu, signé, refusé), preuve de signature. */
export function SignPanel({ documentId, defaultEmail, current, canManage, editable }: { documentId: string; defaultEmail: string; current: SigView | null; canManage: boolean; editable: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const fmt = (iso: string) => new Intl.DateTimeFormat("fr-BE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r: { ok: boolean; message?: string; error?: string } = await fn().catch(() => ({ ok: false, error: "Action impossible. Vérifiez votre connexion." }));
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Fait.") : (r.error ?? "Action impossible.") });
      router.refresh();
    });
  const open = current && (current.status === "pending" || current.status === "viewed");
  return (
    <Card>
      <CardHeader title="Signature en ligne" description={current?.status === "signed" ? undefined : "Le client lit et signe le devis sur son téléphone."} />
      <div className="space-y-3 px-5 pb-5 text-sm">
        {current?.status === "signed" ? (
          <>
            <p className="flex items-center gap-1.5 font-medium text-success"><Check className="size-4" aria-hidden="true" />Signé par {current.signerName}</p>
            {current.path ? <SignatureSvg path={current.path} className="h-20 w-full rounded-lg border border-border bg-white text-black" /> : null}
            <p className="text-muted">Le {fmt(current.signedAt!)} · IP {current.ip}</p>
            <p className="break-all text-xs text-muted">Empreinte : {current.hash}</p>
            <a href={current.url} target="_blank" rel="noopener" className="font-medium text-accent hover:text-accent-hover">Voir la page signée</a>
          </>
        ) : null}
        {open ? (
          <>
            <p><span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", current.status === "viewed" ? "bg-accent-soft text-accent" : "bg-surface-muted text-muted")}>{current.status === "viewed" ? "Ouvert par le client" : "Envoyé"}</span> à {current.email}, le {fmt(current.sentAt)}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon={<Copy className="size-4" aria-hidden="true" />} onClick={() => navigator.clipboard?.writeText(current.url).then(() => setMsg({ ok: true, text: "Lien copié : envoyez-le par WhatsApp ou SMS si vous préférez." }), () => {})}>Copier le lien</Button>
              {canManage ? <Button size="sm" variant="ghost" icon={<X className="size-4" aria-hidden="true" />} disabled={pending} onClick={() => run(() => cancelSignature(documentId))}>Annuler</Button> : null}
            </div>
          </>
        ) : null}
        {current?.status === "declined" ? <p className="text-danger">Refusé par le client{current.reason ? ` : « ${current.reason} »` : "."}</p> : null}
        {current?.status === "expired" ? <p className="text-muted">Le lien envoyé à {current.email} a expiré.</p> : null}
        {canManage && editable && current?.status !== "signed" ? (
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => requestSignature(documentId, email)); }}>
            <label htmlFor="sg-email" className="block font-medium">{open ? "Renvoyer à" : "Email du client"}</label>
            <Input id="sg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
            <Button type="submit" size="sm" loading={pending} disabled={!email} icon={<Send className="size-4" aria-hidden="true" />}>{open ? "Renvoyer un nouveau lien" : "Envoyer pour signature"}</Button>
          </form>
        ) : null}
        {msg ? <p className={cn("rounded-lg px-3 py-2", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      </div>
    </Card>
  );
}
