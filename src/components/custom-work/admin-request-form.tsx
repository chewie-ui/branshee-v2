"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { REQUEST_STATUS } from "@/lib/custom-work";
import { adminSetFeature, adminUpdateCustomRequest } from "@/server/actions/custom-work";

type Res = { ok: boolean; message?: string; error?: string };
const toCents = (s: string) => (s.trim() === "" ? null : Math.round(Number(s.replace(",", ".")) * 100));
const toEuros = (c: number | null) => (c == null ? "" : String(c / 100).replace(".", ","));

export function AdminRequestForm({ id, businessId, initial, catalog, active }: { id: string; businessId: string; initial: { status: string; setupCents: number | null; monthlyCents: number | null; reply: string }; catalog: { key: string; label: string }[]; active: { key: string; monthlyCents: number }[] }) {
  const router = useRouter();
  const [f, setF] = useState({ status: initial.status, setup: toEuros(initial.setupCents), monthly: toEuros(initial.monthlyCents), reply: initial.reply, notify: true });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Res>) => start(async () => { const r: Res = await fn().catch(() => ({ ok: false, error: "Action impossible." })); setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Fait.") : (r.error ?? "Action impossible.") }); router.refresh(); });
  const on = new Set(active.map((a) => a.key));
  return (
    <>
      <Card>
        <CardHeader title="Réponse au client" />
        <form className="grid gap-4 px-5 pb-5" onSubmit={(e) => { e.preventDefault(); const s = toCents(f.setup), m = toCents(f.monthly); if ((s !== null && !Number.isFinite(s)) || (m !== null && !Number.isFinite(m))) return setMsg({ ok: false, text: "Prix invalide." }); run(() => adminUpdateCustomRequest(id, { status: f.status, setupCents: s, monthlyCents: m, reply: f.reply, notify: f.notify })); }}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Statut" htmlFor="ar-status"><Select id="ar-status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{Object.entries(REQUEST_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
            <Field label="Mise en place (€ TVAC)" htmlFor="ar-setup"><Input id="ar-setup" inputMode="decimal" value={f.setup} onChange={(e) => setF({ ...f, setup: e.target.value })} /></Field>
            <Field label="Supplément mensuel (€ TVAC)" htmlFor="ar-monthly"><Input id="ar-monthly" inputMode="decimal" value={f.monthly} onChange={(e) => setF({ ...f, monthly: e.target.value })} /></Field>
          </div>
          <Field label="Message au client" htmlFor="ar-reply"><Textarea id="ar-reply" rows={4} value={f.reply} onChange={(e) => setF({ ...f, reply: e.target.value })} maxLength={5000} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f.notify} onChange={(e) => setF({ ...f, notify: e.target.checked })} />Prévenir le client par email</label>
          <div><Button type="submit" loading={pending}>Enregistrer</Button></div>
        </form>
      </Card>
      <Card>
        <CardHeader title="Fonctionnalités activées pour cette entreprise" description="Seules les modifs déjà codées dans Skydev apparaissent ici." />
        <div className="space-y-2 px-5 pb-5 text-sm">
          {!catalog.length ? <p className="text-muted">Aucune fonctionnalité sur mesure codée pour l&apos;instant.</p> : catalog.map((c) => (
            <div key={c.key} className="flex flex-wrap items-center gap-3">
              <span className="flex-1">{c.label} <code className="text-xs text-muted">{c.key}</code></span>
              <Button size="sm" variant={on.has(c.key) ? "secondary" : "primary"} disabled={pending} onClick={() => run(() => adminSetFeature(businessId, c.key, !on.has(c.key), toCents(f.monthly) ?? 0, id))}>{on.has(c.key) ? "Couper" : "Activer"}</Button>
            </div>
          ))}
        </div>
      </Card>
      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
    </>
  );
}
