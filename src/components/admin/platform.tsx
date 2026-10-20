"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Eye, Trash2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import {
  adminDeleteBusiness,
  adminDeleteUser,
  adminUpdateBusiness,
  createAccessLink,
  createPromoCode,
  decideJobTitle,
  deleteAccessLink,
  deletePromoCode,
  saveCampaign,
  setBoost,
  setFeatureStatus,
  toggleAccessLink,
  toggleNavLink,
  togglePromoCode,
} from "@/server/actions/admin-platform";
import { requestSupervision } from "@/server/actions/supervision";

type R = { ok: boolean; error?: string; message?: string };
function Status({ s }: { s: { ok: boolean; text: string } | null }) {
  return s ? <p className={s.ok ? "text-sm text-success" : "text-sm text-danger"} role="status">{s.text}</p> : null;
}
function useAction() {
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<R>, done?: (r: R) => void) =>
    start(async () => {
      const r = await fn();
      setStatus({ ok: r.ok, text: r.ok ? (r.message ?? "Enregistré.") : (r.error ?? "Erreur.") });
      done?.(r);
    });
  return { status, pending, run };
}
const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(",", "."));

/** Suppression avec confirmation par saisie (email du compte ou nom de l'établissement). */
export function TypeToDelete({ kind, id, expected }: { kind: "user" | "business"; id: string; expected: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const { status, pending, run } = useAction();
  if (!open)
    return (
      <Button variant="secondary" className="text-danger hover:text-danger" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setOpen(true)}>
        {kind === "user" ? "Supprimer le compte" : "Supprimer l'établissement"}
      </Button>
    );
  return (
    <div className="space-y-2 rounded-lg border border-danger/30 bg-danger-soft p-4">
      <p className="text-sm">
        {kind === "user" ? "Le compte et ses établissements seront supprimés. Tapez l'email du compte pour confirmer :" : "L'établissement disparaîtra des pages publiques et de l'espace pro. Tapez son nom pour confirmer :"} <strong className="break-all">{expected}</strong>
      </p>
      <Input value={value} onChange={(e) => setValue(e.target.value)} aria-label="Confirmation" />
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
        <Button variant="danger" size="sm" loading={pending} disabled={value.trim().toLowerCase() !== expected.trim().toLowerCase()} onClick={() => run(() => (kind === "user" ? adminDeleteUser(id, value) : adminDeleteBusiness(id, value)))}>
          Supprimer définitivement
        </Button>
      </div>
      <Status s={status} />
    </div>
  );
}

export function BusinessInfoForm({ id, initial }: { id: string; initial: { name: string; businessType: string; city: string; email: string; phone: string; slug: string } }) {
  const { status, pending, run } = useAction();
  return (
    <form
      className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const v = (k: string) => String(fd.get(k) ?? "");
        run(() => adminUpdateBusiness(id, { name: v("name"), businessType: v("businessType"), city: v("city"), email: v("email"), phone: v("phone"), slug: v("slug") }));
      }}
    >
      <Field label="Nom" htmlFor="bi-name"><Input id="bi-name" name="name" defaultValue={initial.name} maxLength={80} /></Field>
      <Field label="Adresse de la page" htmlFor="bi-slug"><Input id="bi-slug" name="slug" defaultValue={initial.slug} maxLength={60} /></Field>
      <Field label="Métier" htmlFor="bi-type"><Input id="bi-type" name="businessType" defaultValue={initial.businessType} maxLength={60} /></Field>
      <Field label="Ville" htmlFor="bi-city"><Input id="bi-city" name="city" defaultValue={initial.city} maxLength={80} /></Field>
      <Field label="Email" htmlFor="bi-email"><Input id="bi-email" name="email" type="email" defaultValue={initial.email} /></Field>
      <Field label="Téléphone" htmlFor="bi-phone"><Input id="bi-phone" name="phone" defaultValue={initial.phone} maxLength={30} /></Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" loading={pending}>Enregistrer</Button>
        <Status s={status} />
      </div>
    </form>
  );
}

/** Supervision : demande d'accès, puis ouverture de la session quand le pro a accepté. */
export function SupervisionControl({ userId, state }: { userId: string; state: { status: "none" | "pending" | "accepted" | "refused" | "expired"; requestId?: string } }) {
  const { status, pending, run } = useAction();
  return (
    <div className="space-y-2">
      {state.status === "accepted" && state.requestId ? (
        <>
          <p className="text-sm text-success">Le pro a accepté. Le lien est valable 10 minutes.</p>
          <ButtonLink href={`/admin/supervision/${state.requestId}`} prefetch={false} icon={<Eye className="size-4" aria-hidden="true" />}>Ouvrir son espace</ButtonLink>
        </>
      ) : state.status === "pending" ? (
        <p className="text-sm text-muted">Demande envoyée : en attente de la réponse du pro (la page se met à jour toute seule).</p>
      ) : (
        <>
          {state.status === "refused" ? <p className="text-sm text-danger">Le pro a refusé la dernière demande.</p> : null}
          {state.status === "expired" ? <p className="text-sm text-muted">La dernière demande a expiré.</p> : null}
          <Button variant="secondary" loading={pending} icon={<Eye className="size-4" aria-hidden="true" />} onClick={() => run(() => requestSupervision(userId).then((r) => ({ ...r, message: "Demande envoyée." })))}>
            Demander à voir son espace
          </Button>
        </>
      )}
      <Status s={status} />
    </div>
  );
}

export function BoostInput({ id, position }: { id: string; position: number }) {
  const [v, setV] = useState(String(position));
  const { status, pending, run } = useAction();
  return (
    <div className="flex items-center gap-2">
      <Input value={v} onChange={(e) => setV(e.target.value)} inputMode="numeric" className="h-9 w-16" aria-label="Position de mise en avant" />
      <Button size="sm" variant="secondary" loading={pending} disabled={v === String(position)} onClick={() => run(() => setBoost(id, Number(v)))}>OK</Button>
      {status && !status.ok ? <Status s={status} /> : null}
    </div>
  );
}

export function JobDecision({ name, status }: { name: string; status: "pending" | "approved" | "blocked" | "unlisted" }) {
  const { pending, run } = useAction();
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "approved" ? <Button size="sm" loading={pending} onClick={() => run(() => decideJobTitle(name, "approved"))}>Valider</Button> : null}
      {status !== "blocked" ? <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => decideJobTitle(name, "blocked"))}>Bloquer</Button> : null}
      {status === "approved" || status === "blocked" ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => decideJobTitle(name, "pending"))}>Remettre en attente</Button> : null}
    </div>
  );
}

export function FeatureRow({ k, label, status: initial, message, simple }: { k: string; label: string; status: string; message: string; simple?: boolean }) {
  const [value, setValue] = useState(initial);
  const [msg, setMsg] = useState(message);
  const { status, pending, run } = useAction();
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <span className="min-w-0 flex-1 basis-56 text-sm font-medium">{label}</span>
      {simple ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value === "active"} disabled={pending} onChange={(e) => { const s = e.target.checked ? "active" : "disabled"; setValue(s); run(() => setFeatureStatus(k, s, "")); }} className="size-4 accent-[var(--accent)]" />
          {value === "active" ? "Activé" : "Désactivé"}
        </label>
      ) : (
        <>
          <Select value={value} onChange={(e) => setValue(e.target.value)} className="h-9 w-44" aria-label={`Statut : ${label}`}>
            <option value="active">En ligne</option>
            <option value="maintenance">En maintenance</option>
            <option value="error">Erreur temporaire</option>
            <option value="disabled">Désactivée</option>
          </Select>
          <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message affiché (facultatif)" className="h-9 w-64" aria-label={`Message : ${label}`} maxLength={300} />
          <Button size="sm" variant="secondary" loading={pending} disabled={value === initial && msg === message} onClick={() => run(() => setFeatureStatus(k, value as "active", msg))}>Appliquer</Button>
        </>
      )}
      {status && !status.ok ? <Status s={status} /> : null}
    </li>
  );
}

export function NavToggle({ href, label, hidden }: { href: string; label: string; hidden: boolean }) {
  const [h, setH] = useState(hidden);
  const { pending, run } = useAction();
  return (
    <label className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
      <span>{label} <span className="text-muted">{href}</span></span>
      <span className="flex items-center gap-2">
        <input type="checkbox" checked={!h} disabled={pending} onChange={(e) => { setH(!e.target.checked); run(() => toggleNavLink(href, !e.target.checked)); }} className="size-4 accent-[var(--accent)]" />
        {h ? "Masqué" : "Visible"}
      </span>
    </label>
  );
}

export function PromoForm() {
  const [type, setType] = useState("percent");
  const [key, setKey] = useState(0);
  const { status, pending, run } = useAction();
  return (
    <form
      key={key}
      className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const v = (k: string) => String(fd.get(k) ?? "");
        run(
          () => createPromoCode({ code: v("code"), discountType: type as "percent", value: num(fd.get("value")) || 0, trialDays: num(fd.get("trialDays")) || 30, maxUses: v("maxUses") ? num(fd.get("maxUses")) : null, expiresAt: v("expiresAt"), appliesTo: v("appliesTo") as "" }),
          (r) => r.ok && setKey((k) => k + 1),
        );
      }}
    >
      <Field label="Code" htmlFor="p-code"><Input id="p-code" name="code" placeholder="BIENVENUE" className="uppercase" maxLength={30} /></Field>
      <Field label="Type" htmlFor="p-type">
        <Select id="p-type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="percent">Pourcentage (1re période)</option>
          <option value="fixed">Montant fixe (1re facture)</option>
          <option value="trial">Essai gratuit</option>
        </Select>
      </Field>
      {type === "trial" ? (
        <Field label="Jours d'essai" htmlFor="p-days"><Input id="p-days" name="trialDays" type="number" min={1} max={365} defaultValue={30} /></Field>
      ) : (
        <Field label={type === "percent" ? "Réduction (%)" : "Réduction (€)"} htmlFor="p-val"><Input id="p-val" name="value" inputMode="decimal" placeholder={type === "percent" ? "50" : "10"} /></Field>
      )}
      <Field label="Utilisations max." htmlFor="p-max" hint="Vide = illimité"><Input id="p-max" name="maxUses" type="number" min={1} /></Field>
      <Field label="Expire le" htmlFor="p-exp" hint="Vide = jamais"><Input id="p-exp" name="expiresAt" type="date" /></Field>
      <Field label="Valable pour" htmlFor="p-for">
        <Select id="p-for" name="appliesTo" defaultValue="">
          <option value="">Tous les forfaits</option>
          <option value="pro">Pro (mensuel ou annuel)</option>
          <option value="pro_plus">Pro+ (mensuel ou annuel)</option>
          <option value="pro:month">Pro mensuel</option>
          <option value="pro:year">Pro annuel</option>
          <option value="pro_plus:month">Pro+ mensuel</option>
          <option value="pro_plus:year">Pro+ annuel</option>
        </Select>
      </Field>
      <div className="flex items-center gap-3 sm:col-span-3">
        <Button type="submit" loading={pending}>Créer le code</Button>
        <Status s={status} />
      </div>
    </form>
  );
}

export function PromoActions({ id, active, offer }: { id: string; active: boolean; offer: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const { pending, run } = useAction();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => togglePromoCode(id, "isActive"))}>{active ? "Désactiver" : "Activer"}</Button>
      <Button size="sm" variant={offer ? "primary" : "ghost"} disabled={pending} onClick={() => run(() => togglePromoCode(id, "isDefaultOffer"))} title="Proposé automatiquement sur la page Abonnement">{offer ? "Offre affichée" : "Afficher en offre"}</Button>
      {confirm ? (
        <Button size="sm" variant="danger" loading={pending} onClick={() => run(() => deletePromoCode(id))}>Confirmer</Button>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger" aria-label="Supprimer le code"><Trash2 className="size-4" aria-hidden="true" /></button>
      )}
    </div>
  );
}

export function CampaignForm({ initial }: { initial: { isActive: boolean; endsAt: string; firstPeriodEuros: number; plan: "pro" | "pro_plus" } }) {
  const [active, setActive] = useState(initial.isActive);
  const { status, pending, run } = useAction();
  return (
    <form
      className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(() => saveCampaign({ isActive: active, endsAt: String(fd.get("endsAt") ?? ""), firstPeriodEuros: num(fd.get("price")) || 0, plan: String(fd.get("plan")) as "pro" }));
      }}
    >
      <label className="flex items-center gap-2 text-sm font-medium sm:col-span-3">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-[var(--accent)]" />
        Campagne en cours (bandeau avec compte à rebours sur la page Abonnement)
      </label>
      <Field label="Fin de la campagne" htmlFor="c-end"><Input id="c-end" name="endsAt" type="datetime-local" defaultValue={initial.endsAt} /></Field>
      <Field label="Prix de la 1re période (€)" htmlFor="c-price"><Input id="c-price" name="price" inputMode="decimal" defaultValue={String(initial.firstPeriodEuros).replace(".", ",")} /></Field>
      <Field label="Forfait" htmlFor="c-plan">
        <Select id="c-plan" name="plan" defaultValue={initial.plan}>
          <option value="pro">Pro</option>
          <option value="pro_plus">Pro+</option>
        </Select>
      </Field>
      <div className="flex items-center gap-3 sm:col-span-3">
        <Button type="submit" loading={pending}>Enregistrer la campagne</Button>
        <Status s={status} />
      </div>
    </form>
  );
}

export function AccessLinkForm() {
  const [key, setKey] = useState(0);
  const { status, pending, run } = useAction();
  return (
    <form
      key={key}
      className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(() => createAccessLink({ label: String(fd.get("label") ?? ""), plan: String(fd.get("plan")) as "pro", durationDays: num(fd.get("days")) || 30, maxUses: num(fd.get("max")) || 1, expiresAt: String(fd.get("exp") ?? "") }), (r) => r.ok && setKey((k) => k + 1));
      }}
    >
      <Field label="Libellé (interne)" htmlFor="l-label" className="sm:col-span-3"><Input id="l-label" name="label" placeholder="Ex. Partenariat cabinet Dupont" maxLength={120} /></Field>
      <Field label="Forfait offert" htmlFor="l-plan">
        <Select id="l-plan" name="plan" defaultValue="pro">
          <option value="pro">Pro</option>
          <option value="pro_plus">Pro+</option>
        </Select>
      </Field>
      <Field label="Durée (jours)" htmlFor="l-days"><Input id="l-days" name="days" type="number" min={1} max={730} defaultValue={30} /></Field>
      <Field label="Utilisations max." htmlFor="l-max"><Input id="l-max" name="max" type="number" min={1} max={10000} defaultValue={1} /></Field>
      <Field label="Lien valable jusqu'au" htmlFor="l-exp" hint="Vide = sans limite"><Input id="l-exp" name="exp" type="date" /></Field>
      <div className="flex items-center gap-3 sm:col-span-3">
        <Button type="submit" loading={pending}>Créer le lien</Button>
        <Status s={status} />
      </div>
    </form>
  );
}

export function AccessLinkActions({ id, url, active }: { id: string; url: string; active: boolean }) {
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { pending, run } = useAction();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" icon={copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />} onClick={() => navigator.clipboard.writeText(url).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); })}>
        {copied ? "Copié" : "Copier"}
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => toggleAccessLink(id))}>{active ? "Désactiver" : "Activer"}</Button>
      {confirm ? (
        <Button size="sm" variant="danger" loading={pending} onClick={() => run(() => deleteAccessLink(id))}>Confirmer</Button>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger" aria-label="Supprimer le lien"><Trash2 className="size-4" aria-hidden="true" /></button>
      )}
    </div>
  );
}
