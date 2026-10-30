"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, Check, FileText, MapPin, Pencil, Phone, Plus, Printer, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/invoicing/confirm-dialog";
import { SignaturePad } from "@/components/signature/signature-pad";
import { SignatureSvg } from "@/components/signature/signature-svg";
import { cn } from "@/lib/cn";
import { INTERVENTION_STATUS, itemsTotal, type InterventionStatus } from "@/lib/interventions";
import { parseEuros } from "@/lib/stock";
import { addInterventionPhoto, deleteIntervention, invoiceIntervention, removeInterventionPhoto, saveInterventionWork, setInterventionStatus, signIntervention } from "@/server/actions/interventions";
import { InterventionDialog } from "./interventions-list";

type Item = { name: string; qty: number; unitCents: number; vatRate: number };
type Data = { id: string; number: number; title: string; description: string | null; clientName: string; clientPhone: string | null; clientEmail: string | null; address: string | null; customerId: string | null; status: string; scheduledAt: string | null; durationMinutes: number; tech: string | null; technicianId: string | null; report: string; items: Item[]; laborMinutes: number | null; photos: { ref: string; kind: "before" | "after"; name: string }[]; signerName: string | null; signaturePath: string | null; signedAt: string | null; invoiceId: string | null; scheduledLocal: string };
type Res = { ok: boolean; message?: string; error?: string; url?: string };
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(c / 100);

/** Fiche d'intervention, pensée pour le téléphone du technicien : itinéraire, statut, photos, rapport, signature. */
export function InterventionSheet({ data: d, canWork, canManage, canInvoice, team, clients, tz }: { data: Data; canWork: boolean; canManage: boolean; canInvoice: boolean; team: { id: string; name: string }[]; clients: { id: string; name: string }[]; tz: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [report, setReport] = useState(d.report);
  const [items, setItems] = useState<Item[]>(d.items);
  const [draft, setDraft] = useState({ name: "", qty: "1", price: "", vat: "21" });
  const [signer, setSigner] = useState(d.clientName);
  const [path, setPath] = useState("");
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "cancel" | null>(null);
  const [pending, start] = useTransition();
  const st = INTERVENTION_STATUS[d.status as InterventionStatus] ?? INTERVENTION_STATUS.planned;
  // Signée par le client ou facturée : le rapport, les fournitures et les photos sont figés (preuve).
  const locked = !!d.invoiceId || !!d.signedAt;
  const run = (fn: () => Promise<Res>, after?: (r: Res) => void) =>
    start(async () => {
      const r: Res = await fn().catch(() => ({ ok: false, error: "Action impossible. Vérifiez votre connexion." }));
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Fait.") : (r.error ?? "Action impossible.") });
      if (r.ok) after?.(r);
      router.refresh();
    });
  const addItem = () => {
    const price = parseEuros(draft.price || "0");
    const qty = Number(draft.qty.replace(",", "."));
    if (!draft.name.trim() || price === null || !(qty > 0)) return setMsg({ ok: false, text: "Ligne incomplète : nom, quantité et prix." });
    setItems((s) => [...s, { name: draft.name.trim(), qty, unitCents: price, vatRate: Number(draft.vat) }]);
    setDraft({ name: "", qty: "1", price: "", vat: draft.vat });
  };
  const upload = (kind: "before" | "after", files: FileList | null) => {
    if (!files?.length) return;
    start(async () => {
      for (const f of [...files]) {
        const fd = new FormData();
        fd.set("id", d.id); fd.set("kind", kind); fd.set("photo", f);
        const r: Res = await addInterventionPhoto(fd).catch(() => ({ ok: false, error: "Envoi impossible." }));
        setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Photo ajoutée.") : (r.error ?? "Envoi impossible.") });
      }
      router.refresh();
    });
  };
  const when = d.scheduledAt ? new Intl.DateTimeFormat("fr-BE", { timeZone: tz, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(d.scheduledAt)) : "Date à fixer";

  return (
    <div className="space-y-4">
      <Link href="/app/interventions" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" aria-hidden="true" />Interventions</Link>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">{d.title}</h1>
          <p className="text-sm text-muted first-letter:uppercase">{when} · n° {d.number} · {d.tech ?? "technicien à attribuer"}</p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-sm font-medium", d.status === "done" ? "bg-success-soft text-success" : d.status === "cancelled" ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent")}>{st.label}</span>
      </div>
      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <Card className="p-5">
            <p className="font-semibold">{d.clientName}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {d.address ? <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d.address)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted"><MapPin className="size-4" aria-hidden="true" /><span className="max-w-60 truncate">{d.address}</span></a> : null}
              {d.clientPhone ? <a href={`tel:${d.clientPhone.replace(/\s/g, "")}`} className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted"><Phone className="size-4" aria-hidden="true" />{d.clientPhone}</a> : null}
            </div>
            {d.description ? <p className="mt-3 max-w-prose whitespace-pre-line text-sm">{d.description}</p> : null}
          </Card>

          {canWork && st.next ? (
            <Button className="h-14 w-full text-base" loading={pending} icon={<ArrowRight className="size-5" aria-hidden="true" />} onClick={() => run(() => setInterventionStatus(d.id, st.next!))}>{st.action}</Button>
          ) : null}

          <Card>
            <CardHeader title="Photos" description="Avant et après les travaux" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {(["before", "after"] as const).map((k) => (
                <div key={k}>
                  <p className="mb-2 text-sm font-medium">{k === "before" ? "Avant" : "Après"}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {d.photos.filter((p) => p.kind === k).map((p) => (
                      <div key={p.ref} className="relative">
                        <a href={`/app/interventions/${d.id}/photo?ref=${encodeURIComponent(p.ref)}`} target="_blank" rel="noopener">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/app/interventions/${d.id}/photo?ref=${encodeURIComponent(p.ref)}`} alt={`Photo ${k === "before" ? "avant" : "après"}`} className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
                        </a>
                        {canWork && !locked ? <button type="button" onClick={() => run(() => removeInterventionPhoto(d.id, p.ref))} className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-white" aria-label="Retirer la photo"><X className="size-4" aria-hidden="true" /></button> : null}
                      </div>
                    ))}
                    {canWork && !locked ? (
                      <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-xs text-muted hover:border-accent hover:text-accent focus-within:outline-2 focus-within:outline-accent">
                        <Camera className="size-5" aria-hidden="true" />Ajouter
                        <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => upload(k, e.target.files)} aria-label={`Photo ${k === "before" ? "avant" : "après"}`} />
                      </label>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Rapport et fournitures" description={d.laborMinutes ? `Temps sur place : ${Math.floor(d.laborMinutes / 60)} h ${String(d.laborMinutes % 60).padStart(2, "0")}` : undefined} />
            <div className="space-y-4 p-5">
              <div>
                <label htmlFor="iv-report" className="block text-sm font-medium">Travaux réalisés</label>
                <Textarea id="iv-report" rows={4} value={report} onChange={(e) => setReport(e.target.value)} maxLength={8000} disabled={!canWork || locked} className="mt-1" placeholder="Ce qui a été fait, constaté, conseillé…" />
              </div>
              <div>
                <p className="text-sm font-medium">Fournitures et main-d&apos;œuvre (HTVA)</p>
                {items.length ? (
                  <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                    {items.map((it, i) => (
                      <li key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">{it.name}</span>
                        <span className="text-muted tabular-nums">{String(it.qty).replace(".", ",")} × {eur(it.unitCents)}</span>
                        <span className="w-20 text-right font-medium tabular-nums">{eur(Math.round(it.qty * it.unitCents))}</span>
                        {canWork && !locked ? <button type="button" onClick={() => setItems((s) => s.filter((_, j) => j !== i))} className="flex size-8 items-center justify-center rounded text-muted hover:text-danger" aria-label={`Retirer ${it.name}`}><Trash2 className="size-4" aria-hidden="true" /></button> : null}
                      </li>
                    ))}
                    <li className="flex justify-between px-3 py-2 text-sm font-semibold"><span>Total HTVA</span><span className="tabular-nums">{eur(itemsTotal(items))}</span></li>
                  </ul>
                ) : <p className="mt-1 text-sm text-muted">Aucune ligne.</p>}
                {canWork && !locked ? (
                  <div className="mt-2 grid grid-cols-[1fr_64px_96px] gap-2 sm:grid-cols-[1fr_64px_96px_84px_auto]">
                    <Input aria-label="Fourniture ou main-d'œuvre" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex. : Main-d'œuvre (h)" maxLength={160} className="col-span-3 sm:col-span-1" />
                    <Input aria-label="Quantité" inputMode="decimal" value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} />
                    <Input aria-label="Prix unitaire HTVA" inputMode="decimal" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="Prix" />
                    <Select aria-label="TVA" value={draft.vat} onChange={(e) => setDraft({ ...draft, vat: e.target.value })}>{[21, 12, 6, 0].map((r) => <option key={r} value={r}>{r} %</option>)}</Select>
                    <Button type="button" variant="secondary" onClick={addItem} icon={<Plus className="size-4" aria-hidden="true" />} className="col-span-3 sm:col-span-1">Ajouter</Button>
                  </div>
                ) : null}
              </div>
              {canWork && !locked ? <Button loading={pending} onClick={() => run(() => saveInterventionWork({ id: d.id, report, items }))}>Enregistrer le rapport</Button> : null}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Signature du client" />
            <div className="space-y-3 p-5">
              {d.signedAt ? (
                <>
                  <p className="flex items-center gap-1.5 text-sm font-medium text-success"><Check className="size-4" aria-hidden="true" />Signé par {d.signerName}</p>
                  {d.signaturePath ? <SignatureSvg path={d.signaturePath} className="h-20 w-full rounded-lg border border-border bg-white text-black" /> : null}
                  <p className="text-xs text-muted">{new Intl.DateTimeFormat("fr-BE", { timeZone: tz, dateStyle: "medium", timeStyle: "short" }).format(new Date(d.signedAt))}</p>
                </>
              ) : canWork ? (
                <>
                  <p className="text-sm text-muted">Enregistrez le rapport, puis tendez le téléphone au client.</p>
                  <div>
                    <label htmlFor="iv-signer" className="block text-sm font-medium">Nom du client</label>
                    <Input id="iv-signer" value={signer} onChange={(e) => setSigner(e.target.value)} maxLength={120} className="mt-1" />
                  </div>
                  <SignaturePad value={path} onChange={setPath} labelId="iv-pad" label="Signature" />
                  <Button className="w-full" loading={pending} disabled={!path} onClick={() => run(() => signIntervention({ id: d.id, name: signer, path }), () => setPath(""))}>Valider la signature</Button>
                </>
              ) : <p className="text-sm text-muted">Pas encore signée.</p>}
            </div>
          </Card>
          <Card className="space-y-2 p-5">
            <a href={`/imprimer/intervention/${d.id}`} target="_blank" rel="noopener" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border-strong text-sm font-medium hover:bg-surface-muted"><Printer className="size-4" aria-hidden="true" />Bon d&apos;intervention (PDF)</a>
            {canInvoice ? (d.invoiceId ? <Link href={`/app/factures/${d.invoiceId}`} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border-strong text-sm font-medium hover:bg-surface-muted"><FileText className="size-4" aria-hidden="true" />Voir la facture</Link> : <Button className="w-full" variant="secondary" loading={pending} disabled={!items.length} icon={<FileText className="size-4" aria-hidden="true" />} onClick={() => run(() => invoiceIntervention(d.id), (r) => r.url && router.push(r.url))}>Créer la facture</Button>) : null}
            {canManage ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {!d.signedAt ? <Button size="sm" variant="ghost" icon={<Pencil className="size-4" aria-hidden="true" />} onClick={() => setEdit(true)}>Modifier</Button> : null}
                {d.status !== "done" && d.status !== "cancelled" ? <Button size="sm" variant="ghost" onClick={() => setConfirm("cancel")}>Annuler</Button> : null}
                {!d.signedAt ? <Button size="sm" variant="ghost" className="text-danger" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirm("delete")}>Supprimer</Button> : null}
              </div>
            ) : null}
          </Card>
        </div>
      </div>
      {edit ? <InterventionDialog team={team} clients={clients} initial={{ id: d.id, customerId: d.customerId, clientName: d.clientName, clientPhone: d.clientPhone, clientEmail: d.clientEmail, address: d.address, title: d.title, description: d.description, technicianId: d.technicianId, scheduledLocal: d.scheduledLocal, durationMinutes: d.durationMinutes }} onClose={() => setEdit(false)} /> : null}
      <ConfirmDialog open={!!confirm} title={confirm === "delete" ? "Supprimer cette intervention ?" : "Annuler cette intervention ?"} confirmLabel={confirm === "delete" ? "Supprimer" : "Annuler l'intervention"} danger loading={pending} onCancel={() => setConfirm(null)} onConfirm={() => run(() => (confirm === "delete" ? deleteIntervention(d.id) : setInterventionStatus(d.id, "cancelled")), (r) => { setConfirm(null); if (r.url) router.push(r.url); })}>
        {confirm === "delete" ? "L'intervention et ses photos sont supprimées." : "Elle reste dans l'historique, marquée annulée."}
      </ConfirmDialog>
    </div>
  );
}
