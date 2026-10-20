"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/cn";
import {
  changePassword,
  confirmAccountDeletion,
  confirmEmailChange,
  disableTwoFactor,
  enableTwoFactor,
  requestAccountDeletion,
  requestEmailChange,
  setLocale,
  startTwoFactor,
  updateProfile,
} from "@/server/actions/account";

type R = { ok: true; message?: string } | { ok: false; error: string };

function useAction() {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const run = (fn: () => Promise<R>, after?: (r: R) => void) =>
    start(async () => {
      const r = await fn();
      setStatus(r.ok ? { ok: true, msg: r.message ?? "Enregistré." } : { ok: false, msg: r.error });
      after?.(r);
    });
  return { pending, status, setStatus, run };
}

function Status({ s }: { s: { ok: boolean; msg: string } | null }) {
  return s ? <p className={cn("text-sm", s.ok ? "text-success" : "text-danger")} role={s.ok ? "status" : "alert"}>{s.msg}</p> : null;
}

export type ProfileData = { fullName: string; email: string; avatarUrl: string | null; phone: string; gender: string; birthDate: string; address: string; postalCode: string; city: string; country: string; emailNotifications: boolean };

export function ProfileCard({ p, client }: { p: ProfileData; client: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(p.avatarUrl);
  const [removed, setRemoved] = useState(false);
  const { pending, status, run } = useAction();
  return (
    <Card>
      <CardHeader title="Profil" description={client ? "Utilisé pour pré-remplir vos réservations." : "Votre nom et votre photo, visibles par votre équipe."} />
      <form
        className="space-y-5 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          if (removed) fd.set("removeAvatar", "1");
          run(() => updateProfile(fd));
        }}
      >
        <div className="flex items-center gap-4">
          <Avatar name={p.fullName} src={preview} size="lg" className="size-16 text-lg" />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" icon={<ImagePlus className="size-4" aria-hidden="true" />} onClick={() => fileRef.current?.click()}>{preview ? "Changer la photo" : "Ajouter une photo"}</Button>
            {preview ? <Button type="button" variant="ghost" size="sm" onClick={() => { setPreview(null); setRemoved(true); if (fileRef.current) fileRef.current.value = ""; }}>Retirer</Button> : null}
          </div>
          <input ref={fileRef} name="avatar" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Photo de profil" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPreview(URL.createObjectURL(f)); setRemoved(false); } }} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nom complet" htmlFor="pf-name">
            <Input id="pf-name" name="fullName" defaultValue={p.fullName} autoComplete="name" required maxLength={120} />
          </Field>
          <Field label="Téléphone" htmlFor="pf-phone" hint="Avec l'indicatif, ex. +32 470 12 34 56.">
            <Input id="pf-phone" name="phone" type="tel" defaultValue={p.phone} autoComplete="tel" maxLength={40} />
          </Field>
          {client ? (
            <>
              <Field label="Civilité" htmlFor="pf-gender">
                <Select id="pf-gender" name="gender" defaultValue={p.gender}>
                  <option value="">Non précisé</option>
                  <option value="female">Madame</option>
                  <option value="male">Monsieur</option>
                  <option value="other">Autre</option>
                </Select>
              </Field>
              <Field label="Date de naissance" htmlFor="pf-birth">
                <Input id="pf-birth" name="birthDate" type="date" defaultValue={p.birthDate} autoComplete="bday" />
              </Field>
              <Field label="Adresse" htmlFor="pf-address" className="sm:col-span-2">
                <Input id="pf-address" name="address" defaultValue={p.address} autoComplete="street-address" maxLength={160} />
              </Field>
              <Field label="Code postal" htmlFor="pf-zip">
                <Input id="pf-zip" name="postalCode" defaultValue={p.postalCode} autoComplete="postal-code" maxLength={12} />
              </Field>
              <Field label="Ville" htmlFor="pf-city">
                <Input id="pf-city" name="city" defaultValue={p.city} autoComplete="address-level2" maxLength={80} />
              </Field>
              <Field label="Pays" htmlFor="pf-country">
                <Input id="pf-country" name="country" defaultValue={p.country} autoComplete="country-name" maxLength={60} />
              </Field>
            </>
          ) : (
            <>
              <input type="hidden" name="gender" value={p.gender} />
              <input type="hidden" name="birthDate" value={p.birthDate} />
              <input type="hidden" name="address" value={p.address} />
              <input type="hidden" name="postalCode" value={p.postalCode} />
              <input type="hidden" name="city" value={p.city} />
              <input type="hidden" name="country" value={p.country} />
            </>
          )}
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="emailNotifications" defaultChecked={p.emailNotifications} className="mt-0.5 size-4 accent-[var(--accent)]" />
          <span>
            <span className="font-medium">Recevoir les emails d&apos;information</span>
            <span className="block text-muted">Nouveautés et conseils. Les emails liés à vos rendez-vous sont toujours envoyés.</span>
          </span>
        </label>
        <div className="flex items-center justify-end gap-3">
          <Status s={status} />
          <Button type="submit" loading={pending}>Enregistrer</Button>
        </div>
      </form>
    </Card>
  );
}

export function EmailCard({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const [step, setStep] = useState<"idle" | "form" | "code">("idle");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [current, setCurrent] = useState(email);
  const { pending, status, setStatus, run } = useAction();
  return (
    <Card>
      <CardHeader title="Adresse email" description="Sert à vous connecter et à recevoir vos confirmations." />
      <div className="space-y-4 p-5">
        <p className="text-sm">Adresse actuelle : <span className="font-medium">{current}</span></p>
        {step === "idle" ? <Button variant="secondary" size="sm" onClick={() => { setStep("form"); setStatus(null); }}>Changer d&apos;adresse</Button> : null}
        {step === "form" ? (
          <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => requestEmailChange({ email: newEmail, password }), (r) => r.ok && setStep("code")); }}>
            <Field label="Nouvelle adresse" htmlFor="em-new">
              <Input id="em-new" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required autoComplete="email" />
            </Field>
            {hasPassword ? (
              <Field label="Mot de passe actuel" htmlFor="em-pwd">
                <PasswordInput id="em-pwd" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </Field>
            ) : null}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" size="sm" loading={pending}>Recevoir un code</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep("idle")}>Annuler</Button>
            </div>
          </form>
        ) : null}
        {step === "code" ? (
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); run(() => confirmEmailChange(code), (r) => { if (r.ok) { setCurrent(newEmail.toLowerCase()); setStep("idle"); setCode(""); } }); }}>
            <Field label={`Code reçu sur ${newEmail}`} htmlFor="em-code">
              <Input id="em-code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} required className="w-36 tracking-widest" />
            </Field>
            <Button type="submit" size="sm" loading={pending}>Confirmer</Button>
          </form>
        ) : null}
        <Status s={status} />
      </div>
    </Card>
  );
}

export function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const { pending, status, run } = useAction();
  return (
    <Card>
      <CardHeader title="Mot de passe" description={hasPassword ? "Changer de mot de passe déconnecte vos autres appareils." : "Vous vous connectez avec Google : vous pouvez aussi définir un mot de passe."} />
      <form className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => changePassword({ current, next }), (r) => { if (r.ok) { setCurrent(""); setNext(""); } }); }}>
        {hasPassword ? (
          <Field label="Mot de passe actuel" htmlFor="pw-cur">
            <PasswordInput id="pw-cur" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
          </Field>
        ) : null}
        <Field label="Nouveau mot de passe" htmlFor="pw-new" hint="10 caractères minimum.">
          <PasswordInput id="pw-new" value={next} onChange={(e) => setNext(e.target.value)} required autoComplete="new-password" minLength={10} />
        </Field>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" size="sm" loading={pending}>{hasPassword ? "Changer le mot de passe" : "Définir le mot de passe"}</Button>
          <Status s={status} />
        </div>
      </form>
    </Card>
  );
}

export function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const { pending, status, setStatus, run } = useAction();
  const [starting, startT] = useTransition();
  return (
    <Card>
      <CardHeader title="Double authentification" description="En plus du mot de passe, un code à 6 chiffres de votre téléphone (Google Authenticator, Microsoft Authenticator, 1Password…)." />
      <div className="space-y-4 p-5">
        {on ? (
          <>
            <p className="flex items-center gap-2 text-sm font-medium text-success"><ShieldCheck className="size-4" aria-hidden="true" />Activée</p>
            <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); run(() => disableTwoFactor(code), (r) => { if (r.ok) { setOn(false); setCode(""); } }); }}>
              <Field label="Code actuel pour désactiver" htmlFor="tf-off">
                <Input id="tf-off" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={7} required className="w-36 tracking-widest" />
              </Field>
              <Button type="submit" variant="secondary" size="sm" loading={pending}>Désactiver</Button>
            </form>
          </>
        ) : setup ? (
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="QR code à scanner avec votre application d'authentification" className="size-44 shrink-0 rounded-lg border border-border bg-white" />
            <div className="space-y-3 text-sm">
              <p>1. Scannez ce QR code avec votre application.</p>
              <p className="text-muted">Ou saisissez la clé : <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs break-all">{setup.secret}</code></p>
              <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); run(() => enableTwoFactor({ secret: setup.secret, code }), (r) => { if (r.ok) { setOn(true); setSetup(null); setCode(""); } }); }}>
                <Field label="2. Code affiché" htmlFor="tf-on">
                  <Input id="tf-on" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} required className="w-36 tracking-widest" />
                </Field>
                <Button type="submit" size="sm" loading={pending}>Activer</Button>
              </form>
            </div>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            loading={starting}
            onClick={() =>
              startT(async () => {
                setStatus(null);
                const r = await startTwoFactor();
                if (r.ok) setSetup({ secret: r.secret, qr: r.qr });
                else setStatus({ ok: false, msg: r.error });
              })
            }
          >
            Activer la double authentification
          </Button>
        )}
        <Status s={status} />
      </div>
    </Card>
  );
}

const LOCALES = [
  { v: "fr", l: "Français" },
  { v: "en", l: "English" },
  { v: "nl", l: "Nederlands" },
  { v: "de", l: "Deutsch" },
  { v: "es", l: "Español" },
  { v: "it", l: "Italiano" },
];

export function LanguageCard({ locale }: { locale: string }) {
  const { pending, status, run } = useAction();
  return (
    <Card>
      <CardHeader title="Langue" description="Langue de l'interface et des emails que vous recevez." />
      <div className="flex flex-wrap items-center gap-3 p-5">
        <Select defaultValue={locale} onChange={(e) => run(() => setLocale(e.target.value))} disabled={pending} className="w-56" aria-label="Langue">
          {LOCALES.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}
        </Select>
        <Status s={status} />
      </div>
    </Card>
  );
}

export function DeleteAccountCard({ hasPassword, ownsBusiness }: { hasPassword: boolean; ownsBusiness: boolean }) {
  const [step, setStep] = useState<"idle" | "confirm" | "code">("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const { pending, status, run } = useAction();
  return (
    <Card className="border-danger/30">
      <CardHeader title="Supprimer mon compte" description={ownsBusiness ? "Vos établissements seront fermés et retirés de Branshee. Cette action est définitive." : "Votre compte et vos avis seront supprimés. Cette action est définitive."} />
      <div className="space-y-4 p-5">
        {step === "idle" ? <Button variant="danger" size="sm" onClick={() => setStep("confirm")}>Supprimer mon compte…</Button> : null}
        {step === "confirm" ? (
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); run(() => requestAccountDeletion(password), (r) => r.ok && setStep("code")); }}>
            {hasPassword ? (
              <Field label="Mot de passe" htmlFor="del-pwd">
                <PasswordInput id="del-pwd" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </Field>
            ) : null}
            <Button type="submit" variant="danger" size="sm" loading={pending}>Recevoir un code de confirmation</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep("idle")}>Annuler</Button>
          </form>
        ) : null}
        {step === "code" ? (
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); run(() => confirmAccountDeletion(code)); }}>
            <Field label="Code reçu par email" htmlFor="del-code">
              <Input id="del-code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={7} required className="w-36 tracking-widest" />
            </Field>
            <Button type="submit" variant="danger" size="sm" loading={pending}>Supprimer définitivement</Button>
          </form>
        ) : null}
        <Status s={status} />
      </div>
    </Card>
  );
}
