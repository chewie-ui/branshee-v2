"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, FilePen, Mail, Phone, Plus, Search, Trash2, Trophy, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/invoicing/confirm-dialog";
import { cn } from "@/lib/cn";
import { ACTIVITY_KINDS, OPEN_STAGES, SOURCES, STAGES, followUpState, isOpen, stageLabel, weighted, winRate } from "@/lib/sales";
import { addActivity, dealDetail, deleteDeal, linkDealCustomer, moveDeal, quoteFromDeal, saveDeal } from "@/server/actions/sales";
import type { DealView } from "@/server/sales";

type Member = { id: string; name: string };
type Res = { ok: boolean; message?: string; error?: string; id?: string; url?: string };
const eur = (c: number) => new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: c % 100 ? 2 : 0 }).format(c / 100);
const fdate = (d: string) => new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${d}T12:00:00Z`));
const FOLLOW = { late: "bg-danger-soft text-danger", today: "bg-warning-soft text-warning", soon: "bg-surface-muted text-muted", none: "" } as const;

/** Tunnel de vente en colonnes : glisser une piste d'une étape à l'autre, ou l'ouvrir pour tout gérer. */
export function SalesBoard({ deals, team, me, canManage, canQuote, today, openId }: { deals: DealView[]; team: Member[]; me: string; canManage: boolean; canQuote: boolean; today: string; openId: string | null }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sheet, setSheet] = useState<DealView | "new" | null>(() => (openId ? (deals.find((d) => d.id === openId) ?? null) : null));
  const [mine, setMine] = useState(false);
  const [q, setQ] = useState("");
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [lost, setLost] = useState<DealView | null>(null);
  const [pending, start] = useTransition();

  const list = deals.filter((d) => (!mine || d.ownerMemberId === me) && (!q || `${d.title} ${d.companyName ?? ""} ${d.contactName ?? ""}`.toLowerCase().includes(q.toLowerCase())));
  const open = list.filter((d) => isOpen(d.stage));
  const monthStart = today.slice(0, 7);
  const wonMonth = list.filter((d) => d.stage === "won" && d.closedAt?.slice(0, 7) === monthStart);
  const rate = winRate(list);
  const current = sheet && sheet !== "new" ? (deals.find((d) => d.id === sheet.id) ?? null) : null;

  const move = (d: DealView, stage: string) => {
    if (stage === d.stage) return;
    if (stage === "lost") return setLost(d);
    start(async () => {
      const r: Res = await moveDeal(d.id, stage).catch(() => ({ ok: false, error: "Action impossible. Vérifiez votre connexion." }));
      setMsg(r.ok ? (r.message ? { ok: true, text: r.message } : null) : { ok: false, text: r.error ?? "Action impossible." });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4"><p className="text-sm text-muted">En cours</p><p className="mt-1 text-xl font-semibold tabular-nums">{eur(open.reduce((a, d) => a + d.valueCents, 0))}</p><p className="text-xs text-muted">{open.length} piste{open.length > 1 ? "s" : ""} ouverte{open.length > 1 ? "s" : ""}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">Prévision</p><p className="mt-1 text-xl font-semibold tabular-nums">{eur(weighted(open))}</p><p className="text-xs text-muted">Montants × chance de chaque étape</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">Gagné ce mois-ci</p><p className="mt-1 text-xl font-semibold tabular-nums">{eur(wonMonth.reduce((a, d) => a + d.valueCents, 0))}</p><p className="text-xs text-muted">{wonMonth.length} vente{wonMonth.length > 1 ? "s" : ""}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted">Taux de réussite</p><p className="mt-1 text-xl font-semibold tabular-nums">{rate === null ? "—" : `${rate} %`}</p><p className="text-xs text-muted">Sur les pistes clôturées (12 mois)</p></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <label htmlFor="deal-q" className="sr-only">Rechercher une piste</label>
          <Input id="deal-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" className="pl-9" />
        </div>
        {team.length > 1 ? (
          <div className="inline-flex rounded-lg bg-surface-muted p-1" role="group" aria-label="Pistes affichées">
            {[{ v: false, l: "Toute l'équipe" }, { v: true, l: "Mes pistes" }].map((o) => (
              <button key={o.l} type="button" aria-pressed={mine === o.v} onClick={() => setMine(o.v)} className={cn("h-8 rounded-md px-3 text-sm font-medium", mine === o.v ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text")}>{o.l}</button>
            ))}
          </div>
        ) : null}
        {canManage ? <Button className="ml-auto" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => { setMsg(null); setSheet("new"); }}>Nouvelle piste</Button> : null}
      </div>
      {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}

      {deals.length === 0 ? (
        <Card className="p-8 text-center">
          <Trophy className="mx-auto size-10 text-muted" aria-hidden="true" />
          <p className="mt-3 font-medium">Aucune piste pour l&apos;instant</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">Notez chaque demande ou prospect : qui, pour combien, et quand le relancer. Vous ne perdez plus aucune vente par oubli.</p>
          {canManage ? <Button className="mt-4" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setSheet("new")}>Ajouter ma première piste</Button> : null}
        </Card>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="grid min-w-[880px] grid-cols-4 gap-3">
            {OPEN_STAGES.map((s) => {
              const col = open.filter((d) => d.stage === s.id);
              return (
                <section
                  key={s.id}
                  aria-labelledby={`st-${s.id}`}
                  onDragOver={(e) => { if (drag && canManage) { e.preventDefault(); setOver(s.id); } }}
                  onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
                  onDrop={(e) => { e.preventDefault(); setOver(null); const d = deals.find((x) => x.id === drag); if (d) move(d, s.id); setDrag(null); }}
                  className={cn("min-w-0 rounded-xl bg-surface-muted/60 p-2 transition-colors", over === s.id && "bg-accent-soft")}
                >
                  <div className="mb-2 px-2 pt-1">
                    <h2 id={`st-${s.id}`} className="flex items-center justify-between text-sm font-semibold">{s.label}<span className="text-xs font-normal text-muted">{s.chance} %</span></h2>
                    <p className="text-xs text-muted tabular-nums">{col.length} · {eur(col.reduce((a, d) => a + d.valueCents, 0))}</p>
                  </div>
                  <ul className="space-y-2">
                    {col.map((d) => {
                      const f = followUpState(d.nextActionDate, today);
                      return (
                        <li key={d.id} draggable={canManage} onDragStart={() => setDrag(d.id)} onDragEnd={() => { setDrag(null); setOver(null); }} className={cn(drag === d.id && "opacity-50")}>
                          <button type="button" onClick={() => { setMsg(null); setSheet(d); }} className="w-full rounded-lg border border-border bg-surface p-3 text-left shadow-sm transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                            <span className="block truncate text-sm font-medium">{d.title}</span>
                            {d.companyName || d.contactName ? <span className="block truncate text-xs text-muted">{d.companyName || d.contactName}</span> : null}
                            <span className="mt-2 flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold tabular-nums">{eur(d.valueCents)}</span>
                              {f !== "none" ? <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold", FOLLOW[f])}><CalendarClock className="size-3" aria-hidden="true" />{f === "late" ? "En retard" : f === "today" ? "Aujourd'hui" : fdate(d.nextActionDate!)}</span> : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                    {col.length === 0 ? <li className="px-2 py-4 text-center text-xs text-muted">Glissez une piste ici</li> : null}
                  </ul>
                </section>
              );
            })}
          </div>
          {canManage ? (
            <div className="mt-3 grid min-w-[880px] grid-cols-2 gap-3">
              {(["won", "lost"] as const).map((s) => (
                <div
                  key={s}
                  onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(s); } }}
                  onDragLeave={() => setOver((o) => (o === s ? null : o))}
                  onDrop={(e) => { e.preventDefault(); setOver(null); const d = deals.find((x) => x.id === drag); if (d) move(d, s); setDrag(null); }}
                  className={cn("rounded-xl border-2 border-dashed p-3 text-center text-sm transition-colors", drag ? "border-border-strong" : "border-border", over === s && (s === "won" ? "border-success bg-success-soft" : "border-danger bg-danger-soft"))}
                >
                  <span className="font-medium">{stageLabel(s)}</span> <span className="text-muted">· {list.filter((d) => d.stage === s).length} sur 12 mois{drag ? " · déposez ici" : ""}</span>
                </div>
              ))}
            </div>
          ) : null}
          {/* Pistes gagnées ou perdues : on peut les rouvrir (changer d'étape, supprimer). */}
          {list.some((d) => !isOpen(d.stage)) ? (
            <details className="mt-3 rounded-xl border border-border bg-surface">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Pistes clôturées ({list.filter((d) => !isOpen(d.stage)).length})</summary>
              <ul className="divide-y divide-border border-t border-border">
                {list.filter((d) => !isOpen(d.stage)).map((d) => (
                  <li key={d.id}>
                    <button type="button" onClick={() => { setMsg(null); setSheet(d); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-muted">
                      <span className={cn("rounded px-1.5 text-xs font-medium", d.stage === "won" ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>{stageLabel(d.stage)}</span>
                      <span className="min-w-0 flex-1 truncate">{d.title}</span>
                      <span className="tabular-nums text-muted">{eur(d.valueCents)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      )}

      {sheet ? (
        <DealSheet
          key={sheet === "new" ? "new" : sheet.id}
          deal={sheet === "new" ? null : (current ?? sheet)}
          team={team}
          me={me}
          today={today}
          canManage={canManage}
          canQuote={canQuote}
          onClose={() => { setSheet(null); if (openId) router.replace("/app/ventes", { scroll: false }); }}
          onMove={(d, s) => move(d, s)}
          onDone={(text, created) => { setMsg({ ok: true, text }); if (created) setSheet(null); router.refresh(); }}
        />
      ) : null}
      <LostDialog deal={lost} pending={pending} onCancel={() => setLost(null)} onConfirm={(reason) => lost && start(async () => { const r: Res = await moveDeal(lost.id, "lost", reason).catch(() => ({ ok: false, error: "Action impossible." })); setLost(null); setMsg(r.ok ? { ok: true, text: r.message ?? "Piste classée perdue." } : { ok: false, text: r.error ?? "Action impossible." }); router.refresh(); })} />
    </div>
  );
}

function LostDialog({ deal, pending, onCancel, onConfirm }: { deal: DealView | null; pending: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <ConfirmDialog open={!!deal} title={`Classer « ${deal?.title ?? ""} » perdue ?`} confirmLabel="Classer perdue" danger loading={pending} onCancel={onCancel} onConfirm={() => onConfirm(reason)}>
      <label htmlFor="lost-reason" className="block text-sm">Pourquoi ? (facultatif, pour en tirer des leçons)</label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {["Trop cher", "A choisi un concurrent", "Pas de réponse", "Projet abandonné"].map((r) => <button key={r} type="button" onClick={() => setReason(r)} className={cn("rounded-full border px-2.5 py-1 text-xs", reason === r ? "border-accent text-accent" : "border-border hover:border-border-strong")}>{r}</button>)}
      </div>
      <Input id="lost-reason" className="mt-2" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
    </ConfirmDialog>
  );
}

type Detail = NonNullable<Awaited<ReturnType<typeof dealDetail>>>;

/** Panneau d'une piste : coordonnées, relance, historique, devis et actions. */
function DealSheet({ deal, team, me, today, canManage, canQuote, onClose, onMove, onDone }: { deal: DealView | null; team: Member[]; me: string; today: string; canManage: boolean; canQuote: boolean; onClose: () => void; onMove: (d: DealView, s: string) => void; onDone: (text: string, created?: boolean) => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [f, setF] = useState(() => ({
    title: deal?.title ?? "", contactName: deal?.contactName ?? "", companyName: deal?.companyName ?? "", email: deal?.email ?? "", phone: deal?.phone ?? "",
    value: deal ? String(deal.valueCents / 100).replace(".", ",") : "", source: deal?.source ?? "", ownerMemberId: deal?.ownerMemberId ?? me,
    expectedClose: deal?.expectedClose ?? "", nextActionDate: deal?.nextActionDate ?? "", nextAction: deal?.nextAction ?? "", stage: "lead",
  }));
  const [detail, setDetail] = useState<Detail | null>(null);
  const [kind, setKind] = useState<"note" | "call" | "email" | "meeting">("call");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const ro = !canManage;

  const load = useCallback(() => {
    if (!deal) return;
    dealDetail(deal.id).then(setDetail, () => {});
  }, [deal]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input,button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const call = (fn: () => Promise<Res>, then?: (r: Res) => void) =>
    start(async () => {
      setError(null);
      const r: Res = await fn().catch(() => ({ ok: false, error: "Action impossible. Vérifiez votre connexion et réessayez." }));
      if (!r.ok) return setError(r.error ?? "Action impossible.");
      then?.(r);
    });
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    call(() => saveDeal({ ...f, id: deal?.id }), (r) => onDone(r.message ?? "Enregistré.", !deal));
  };
  const log = () => call(() => addActivity({ dealId: deal!.id, kind, body, ...(f.nextActionDate !== (deal?.nextActionDate ?? "") || f.nextAction !== (deal?.nextAction ?? "") ? { nextActionDate: f.nextActionDate, nextAction: f.nextAction } : {}) }), (r) => { setBody(""); onDone(r.message ?? "Ajouté."); load(); });
  const quick = (days: number) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    setF((s) => ({ ...s, nextActionDate: d.toISOString().slice(0, 10) }));
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="deal-title">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" tabIndex={-1} onClick={onClose} />
      <div ref={ref} className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-surface shadow-xl">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-surface px-5 py-3">
          <h2 id="deal-title" className="min-w-0 flex-1 truncate text-lg font-semibold">{deal ? deal.title : "Nouvelle piste"}</h2>
          <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-muted" aria-label="Fermer"><X className="size-5" aria-hidden="true" /></button>
        </div>

        {deal ? (
          <div className="border-b border-border px-5 py-4">
            <p className="mb-2 text-sm font-medium" id="stage-label">Étape</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="stage-label">
              {STAGES.map((s) => (
                <button key={s.id} type="button" disabled={ro || pending} aria-pressed={deal.stage === s.id} onClick={() => onMove(deal, s.id)} className={cn("h-9 rounded-full border px-3 text-sm transition-colors disabled:cursor-default", deal.stage === s.id ? (s.id === "won" ? "border-success bg-success-soft font-medium text-success" : s.id === "lost" ? "border-danger bg-danger-soft font-medium text-danger" : "border-accent bg-accent-soft font-medium text-accent") : "border-border text-muted enabled:hover:border-border-strong enabled:hover:text-text")}>{s.label}</button>
              ))}
            </div>
            {deal.stage === "lost" && deal.lostReason ? <p className="mt-2 text-sm text-muted">Raison : {deal.lostReason}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {deal.email ? <a href={`mailto:${deal.email}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted"><Mail className="size-4" aria-hidden="true" />Email</a> : null}
              {deal.phone ? <a href={`tel:${deal.phone.replace(/\s/g, "")}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted"><Phone className="size-4" aria-hidden="true" />Appeler</a> : null}
              {canManage && canQuote ? <Button size="sm" className="h-9" variant="secondary" disabled={pending} icon={<FilePen className="size-4" aria-hidden="true" />} onClick={() => call(() => quoteFromDeal(deal.id), (r) => r.url && router.push(r.url))}>Faire un devis</Button> : null}
              {deal.customerId ? (
                <Link href={`/app/clients/${deal.customerId}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-muted"><UserRound className="size-4" aria-hidden="true" />Fiche client</Link>
              ) : canManage ? (
                <Button size="sm" className="h-9" variant="secondary" disabled={pending} icon={<UserRound className="size-4" aria-hidden="true" />} onClick={() => call(() => linkDealCustomer(deal.id), (r) => onDone(r.message ?? "Fiche client reliée."))}>Créer la fiche client</Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <form onSubmit={save} className="space-y-4 px-5 py-4" noValidate>
          <fieldset disabled={ro} className="grid gap-4 sm:grid-cols-2">
            <legend className="sr-only">Informations de la piste</legend>
            <Field label="Nom de la piste" htmlFor="d-title" className="sm:col-span-2"><Input id="d-title" value={f.title} onChange={set("title")} maxLength={120} placeholder="Ex. : Site web pour la boulangerie Dupont" required /></Field>
            <Field label="Contact" htmlFor="d-contact"><Input id="d-contact" value={f.contactName} onChange={set("contactName")} maxLength={120} placeholder="Prénom Nom" /></Field>
            <Field label="Entreprise" htmlFor="d-company"><Input id="d-company" value={f.companyName} onChange={set("companyName")} maxLength={120} /></Field>
            <Field label="Email" htmlFor="d-email"><Input id="d-email" type="email" value={f.email} onChange={set("email")} maxLength={200} /></Field>
            <Field label="Téléphone" htmlFor="d-phone"><Input id="d-phone" type="tel" value={f.phone} onChange={set("phone")} maxLength={40} /></Field>
            <Field label="Montant estimé (€ HTVA)" htmlFor="d-value"><Input id="d-value" inputMode="decimal" value={f.value} onChange={set("value")} placeholder="0" /></Field>
            <Field label="Signature espérée" htmlFor="d-close"><Input id="d-close" type="date" value={f.expectedClose} onChange={set("expectedClose")} /></Field>
            <Field label="Origine" htmlFor="d-source">
              <Select id="d-source" value={f.source} onChange={set("source")}>
                <option value="">—</option>
                {SOURCES.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            {team.length > 1 ? (
              <Field label="Responsable" htmlFor="d-owner">
                <Select id="d-owner" value={f.ownerMemberId} onChange={set("ownerMemberId")}>
                  {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Select>
              </Field>
            ) : null}
            {!deal ? (
              <Field label="Étape" htmlFor="d-stage">
                <Select id="d-stage" value={f.stage} onChange={set("stage")}>
                  {OPEN_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              </Field>
            ) : null}
          </fieldset>
          <fieldset disabled={ro} className="rounded-xl border border-border p-4">
            <legend className="px-1 text-sm font-medium">Prochaine relance</legend>
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <div>
                <label htmlFor="d-next" className="sr-only">Date de relance</label>
                <Input id="d-next" type="date" value={f.nextActionDate} onChange={set("nextActionDate")} />
              </div>
              <div>
                <label htmlFor="d-next-what" className="sr-only">Quoi faire</label>
                <Input id="d-next-what" value={f.nextAction} onChange={set("nextAction")} maxLength={200} placeholder="Ex. : rappeler pour le devis" />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[{ l: "Demain", d: 1 }, { l: "Dans 3 jours", d: 3 }, { l: "Dans 1 semaine", d: 7 }, { l: "Dans 1 mois", d: 30 }].map((o) => <button key={o.l} type="button" onClick={() => quick(o.d)} className="rounded-full border border-border px-2.5 py-1 text-xs hover:border-accent hover:text-accent">{o.l}</button>)}
              {f.nextActionDate ? <button type="button" onClick={() => setF((s) => ({ ...s, nextActionDate: "", nextAction: "" }))} className="rounded-full px-2.5 py-1 text-xs text-muted hover:text-danger">Aucune</button> : null}
            </div>
          </fieldset>
          {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              {deal ? <Button type="button" variant="ghost" className="mr-auto text-danger" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirm(true)} disabled={pending}>Supprimer</Button> : <span className="mr-auto" />}
              <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Fermer</Button>
              <Button type="submit" loading={pending}>{deal ? "Enregistrer" : "Ajouter la piste"}</Button>
            </div>
          ) : null}
        </form>

        {deal ? (
          <div className="border-t border-border px-5 py-4">
            <h3 className="font-semibold">Historique</h3>
            {canManage ? (
              <div className="mt-3 rounded-xl border border-border p-3">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Type d'échange">
                  {(["call", "email", "meeting", "note"] as const).map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={cn("h-8 rounded-full border px-3 text-xs", kind === k ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-muted hover:text-text")}>{ACTIVITY_KINDS[k]}</button>)}
                </div>
                <label htmlFor="d-log" className="sr-only">Compte rendu</label>
                <Textarea id="d-log" className="mt-2" rows={2} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Ce qui s'est dit, ce qui est convenu…" />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted">La relance ci-dessus est mise à jour avec.</p>
                  <Button size="sm" disabled={!body.trim()} loading={pending} onClick={log}>Ajouter</Button>
                </div>
              </div>
            ) : null}
            {detail?.documents.length ? (
              <div className="mt-4">
                <p className="text-sm font-medium">Devis et factures du client</p>
                <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                  {detail.documents.map((d) => (
                    <li key={d.id}><Link href={`/app/factures/${d.id}`} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-muted"><span className="flex-1">{d.docType === "quote" ? "Devis" : d.docType === "credit" ? "Note de crédit" : "Facture"} {d.number ?? "(brouillon)"}</span><span className="text-muted">{DOC_STATUS[d.status] ?? d.status}</span><span className="w-20 text-right tabular-nums">{eur(d.ttcCents)}</span></Link></li>
                  ))}
                </ul>
              </div>
            ) : null}
            <ol className="mt-4 space-y-3">
              {detail === null ? <li className="h-12 animate-pulse rounded-lg bg-surface-muted" aria-label="Chargement" /> : null}
              {detail?.activities.map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", a.kind === "stage" ? "bg-border-strong" : "bg-accent")} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className={cn("whitespace-pre-line", a.kind === "stage" && "text-muted")}>{a.kind !== "stage" ? <span className="font-medium">{ACTIVITY_KINDS[a.kind as keyof typeof ACTIVITY_KINDS] ?? a.kind} · </span> : null}{a.body}</p>
                    <p className="text-xs text-muted">{new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(a.createdAt))}{a.by ? ` · ${a.by}` : ""}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
      <ConfirmDialog open={confirm} title="Supprimer cette piste ?" confirmLabel="Supprimer" danger loading={pending} onCancel={() => setConfirm(false)} onConfirm={() => deal && call(() => deleteDeal(deal.id), (r) => { setConfirm(false); onDone(r.message ?? "Supprimée.", true); onClose(); })}>
        La piste et son historique sont supprimés. La fiche client et les devis restent.
      </ConfirmDialog>
    </div>
  );
}

const DOC_STATUS: Record<string, string> = { draft: "Brouillon", sent: "Envoyé", paid: "Payée", cancelled: "Annulé", accepted: "Accepté", refused: "Refusé", invoiced: "Facturé" };
