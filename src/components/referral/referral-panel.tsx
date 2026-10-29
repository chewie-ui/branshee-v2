"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Check, Copy, Gift, Mail, MessageCircle, Share2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { REFERRAL_MAX_PER_YEAR, referralMessage } from "@/lib/referral";
import { claimReferral } from "@/server/actions/billing";

const noop = () => () => {};
type Friend = { name: string; createdAt: string; paying: boolean };
const fmtDate = (iso: string) => new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
const share = "inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium text-text transition-colors duration-150 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Page Parrainage : lien à partager, messages prêts, compteur et mois à utiliser. */
export function ReferralPanel({ brand, code, link, paying, claimable, claimed, invited, canClaim }: { brand: string; code: string; link: string; paying: number; claimable: number; claimed: number; invited: Friend[]; canClaim: boolean }) {
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const canShare = useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);
  const text = referralMessage(brand, link);
  const pendingFriends = invited.filter((f) => !f.paying).length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papiers indisponible : le lien reste sélectionnable */
    }
  };
  const nativeShare = async () => {
    try {
      await navigator.share({ title: brand, text, url: link });
    } catch {
      /* partage annulé */
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-accent/20 bg-accent-soft p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Gift className="size-6" aria-hidden="true" /></span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-accent-soft-foreground sm:text-2xl">1 mois offert pour chaque pro que vous invitez</h2>
            <p className="mt-1 max-w-prose text-sm text-accent-soft-foreground">Un collègue, un ami indépendant, votre comptable… Chaque personne qui s&apos;abonne à {brand} grâce à votre lien vous fait gagner 1 mois d&apos;abonnement offert (29 €). Sans limite de métier.</p>
          </div>
        </div>

        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { n: 1, t: "Partagez votre lien", d: "Par WhatsApp, SMS ou email, en un clic." },
            { n: 2, t: "Il essaie gratuitement", d: "Puis il s'abonne s'il est convaincu." },
            { n: 3, t: "Vous gagnez 29 €", d: "1 mois offert dès son 2e paiement. Vous êtes prévenu par email." },
          ].map((s) => (
            <li key={s.n} className="rounded-xl bg-surface p-4">
              <span className="flex size-7 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground" aria-hidden="true">{s.n}</span>
              <p className="mt-2 text-sm font-semibold text-text">{s.t}</p>
              <p className="text-sm text-muted">{s.d}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-1.5 pl-4">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-text" title={link}>{link.replace(/^https?:\/\//, "")}</span>
          <Button onClick={copy} icon={copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}>{copied ? "Lien copié" : "Copier mon lien"}</Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <a className={share} href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" aria-hidden="true" />WhatsApp</a>
          <a className={share} href={`sms:?&body=${encodeURIComponent(text)}`}><Smartphone className="size-4" aria-hidden="true" />SMS</a>
          <a className={share} href={`mailto:?subject=${encodeURIComponent(`Je te conseille ${brand}`)}&body=${encodeURIComponent(text)}`}><Mail className="size-4" aria-hidden="true" />Email</a>
          {canShare ? <button type="button" className={share} onClick={nativeShare}><Share2 className="size-4" aria-hidden="true" />Autre</button> : null}
        </div>
        <p className="mt-3 text-xs text-accent-soft-foreground">Votre code : <span className="font-mono font-semibold">{code}</span>. Il est aussi dans le lien « propulsé par {brand} » de votre page de réservation et de votre site : si un de vos clients s&apos;abonne depuis là, le mois est pour vous.</p>
      </section>

      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { v: invited.length, l: invited.length > 1 ? "invités inscrits" : "invité inscrit" },
          { v: paying, l: paying > 1 ? "abonnés validés" : "abonné validé" },
          { v: claimable, l: claimable > 1 ? "mois à utiliser" : "mois à utiliser", hi: claimable > 0 },
        ].map((s) => (
          <div key={s.l} className={cn("rounded-xl border p-4", s.hi ? "border-success/30 bg-success-soft" : "border-border bg-surface")}>
            <p className={cn("text-2xl font-semibold", s.hi ? "text-success" : "text-text")}>{s.v}</p>
            <p className="text-xs text-muted sm:text-sm">{s.l}</p>
          </div>
        ))}
      </div>

      {claimable > 0 ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-text">Bravo, vous avez {claimable} mois offert{claimable > 1 ? "s" : ""} !</p>
          <p className="mt-1 text-sm text-muted">{canClaim ? "Le montant est déduit automatiquement de vos prochaines factures." : "Abonnez-vous pour les utiliser : ils seront déduits de vos premières factures."}</p>
          {canClaim ? <Button className="mt-3" loading={pending} icon={<Gift className="size-4" aria-hidden="true" />} onClick={() => start(async () => { const r = await claimReferral(); setMsg(r.ok ? { ok: true, text: r.message ?? "C'est fait." } : { ok: false, text: r.error }); })}>Utiliser mes {claimable} mois offerts</Button> : null}
          {msg ? <p className={cn("mt-2 text-sm", msg.ok ? "text-success" : "text-danger")} role="status">{msg.text}</p> : null}
        </Card>
      ) : msg ? <p className={cn("text-sm", msg.ok ? "text-success" : "text-danger")} role="status">{msg.text}</p> : null}

      <Card>
        <CardHeader title="Vos invités" description={invited.length ? `${pendingFriends ? `${pendingFriends} en essai ou pas encore validé${pendingFriends > 1 ? "s" : ""}. ` : ""}${claimed ? `${claimed} mois déjà utilisé${claimed > 1 ? "s" : ""}.` : ""}`.trim() || undefined : undefined} />
        {invited.length ? (
          <ul className="divide-y divide-border">
            {invited.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="min-w-0 truncate text-text">{f.name}</span>
                <span className={cn("shrink-0", f.paying ? "font-medium text-success" : "text-muted")}>{f.paying ? "1 mois gagné" : `Inscrit le ${fmtDate(f.createdAt)}`}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 pb-5 text-sm text-muted">Personne pour l&apos;instant. Pensez aux pros que vous croisez : collègues, voisins de cabinet, fournisseurs, amis indépendants.</p>
        )}
      </Card>

      <p className="text-xs text-muted">Conditions : un invité compte une seule fois, après son 2e paiement d&apos;abonnement (pas pendant l&apos;essai gratuit). Chaque invité validé vaut 1 mois d&apos;abonnement de base (29 € TVAC, la valeur d&apos;un utilisateur), crédité sur vos prochaines factures. Maximum {REFERRAL_MAX_PER_YEAR} mois gagnés par année civile. Les comptes créés pour s&apos;inviter soi-même ne comptent pas.</p>
    </div>
  );
}
