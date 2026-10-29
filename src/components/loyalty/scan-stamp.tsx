"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { scanStamp, type ScanResult } from "@/server/actions/loyalty-scan";

/** Le client a scanné : tampon tout de suite s'il est reconnu, sinon prénom + email la première fois. */
export function ScanStamp({ b, w, s }: { b: string; w: number; s: string }) {
  const router = useRouter();
  const [res, setRes] = useState<ScanResult | null>(null);
  const [need, setNeed] = useState<Extract<ScanResult, { need: "identify" }> | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "" });
  const [pending, start] = useTransition();
  const once = useRef(false);

  const done = (r: ScanResult) => {
    if (r.ok && r.token) return router.replace(`/fidelite/${r.token}?tampon=${r.already ? "deja" : "1"}`);
    if (!r.ok && "need" in r) return setNeed(r);
    // Erreur pendant la saisie : le formulaire reste affiché avec le message.
    if (!r.ok && need) return setFormError(r.error);
    setRes(r);
  };

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    start(async () => done(await scanStamp({ b, w, s }).catch(() => ({ ok: false as const, error: "Connexion impossible. Réessayez." }))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!res && !need) return <div className="w-full max-w-sm rounded-3xl bg-surface p-8 text-center shadow-sm" role="status"><div className="mx-auto size-10 animate-spin rounded-full border-4 border-accent-soft border-t-accent" aria-hidden="true" /><p className="mt-4 text-sm text-muted">Ajout de votre tampon…</p></div>;

  if (res?.ok) {
    // Fiche existante reconnue par l'email : la carte est envoyée par email plutôt qu'affichée.
    return (
      <div className="w-full max-w-sm rounded-3xl bg-accent p-6 text-center text-accent-foreground shadow-lg">
        <Star className="mx-auto size-10 fill-current" aria-hidden="true" />
        <h1 className="mt-3 text-2xl font-semibold">{res.already ? "Déjà tamponné aujourd'hui" : "Tampon ajouté !"}</h1>
        <p className="mt-2 opacity-90">{res.business}</p>
        <p className="mt-4 rounded-xl bg-white/15 px-4 py-3 text-sm">Vous avez {res.stamps} tampon{res.stamps > 1 ? "s" : ""} sur {res.goal}. Au bout : {res.reward}.</p>
        <p className="mt-3 text-xs opacity-80">Le lien de votre carte vous a été envoyé par email.</p>
      </div>
    );
  }

  if (need && !res) {
    return (
      <form
        className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-sm"
        onSubmit={(e) => { e.preventDefault(); setFormError(null); start(async () => done(await scanStamp({ b, w, s, ...form }).catch(() => ({ ok: false as const, error: "Connexion impossible. Réessayez." })))); }}
      >
        <p className="text-sm font-medium text-accent">{need.business}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Votre carte de fidélité</h1>
        <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent-soft-foreground"><Gift className="size-4" aria-hidden="true" />{need.goal} tampons = {need.reward}</p>
        <p className="mt-4 text-sm text-muted">Première fois ? Indiquez votre nom et votre email pour créer votre carte. La prochaine fois, un scan suffira.</p>
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom" htmlFor="sc-fn"><Input id="sc-fn" required autoComplete="given-name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} maxLength={60} /></Field>
            <Field label="Nom" htmlFor="sc-ln"><Input id="sc-ln" autoComplete="family-name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} maxLength={80} /></Field>
          </div>
          <Field label="Email" htmlFor="sc-em"><Input id="sc-em" type="email" required autoComplete="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={200} /></Field>
        </div>
        {formError ? <p className="mt-3 text-sm text-danger" role="alert">{formError}</p> : null}
        <Button type="submit" className="mt-5 w-full" loading={pending}>Recevoir mon tampon</Button>
        <p className="mt-3 text-xs text-muted">Votre email sert uniquement à retrouver votre carte et à vous l&apos;envoyer.</p>
      </form>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-3xl bg-surface p-6 text-center shadow-sm" role="alert">
      <h1 className="text-xl font-semibold">Oups</h1>
      <p className="mt-2 text-sm text-muted">{res && !res.ok && "error" in res ? res.error : "Réessayez."}</p>
    </div>
  );
}
