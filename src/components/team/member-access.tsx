"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { useT } from "@/components/app-locale";
import { cn } from "@/lib/cn";
import { setMemberAccessEmail } from "@/server/actions/team";

export type MemberAccessState = { kind: "account"; email: string } | { kind: "invited"; email: string } | { kind: "pending"; email: string } | { kind: "none" };

/**
 * « Accès » d'un membre : avec son compte, invitation en cours, ou sans accès (membre ajouté sans email).
 * Sans accès, on ajoute son email à tout moment : il garde sa fiche, ses horaires et ses rendez-vous.
 */
export function MemberAccess({ memberId, name, state, brand }: { memberId: string; name: string; state: MemberAccessState; brand: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(state.kind === "pending" ? state.email : "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const send = (value: string) =>
    start(async () => {
      setMsg(null);
      const r = await setMemberAccessEmail(memberId, value);
      setMsg({ ok: r.ok, text: r.ok ? r.message : r.error });
      if (r.ok) {
        setEditing(false);
        router.refresh();
      }
    });

  const showForm = state.kind === "none" || editing;

  return (
    <Card className="mb-6">
      <CardHeader title={t("Accès à {brand}", { brand })} />
      <div className="space-y-4 p-5">
        {state.kind === "account" ? (
          <p className="flex items-start gap-3 text-sm">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
            <span>{t("{name} se connecte avec son propre compte", { name })} (<b>{state.email}</b>). {t("Ce qu'il voit et peut faire dépend de son grade.")}</span>
          </p>
        ) : state.kind === "invited" ? (
          <p className="flex items-start gap-3 text-sm">
            <Mail className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            <span>{t("Invitation envoyée à")} <b>{state.email}</b>. {t("Il doit créer son compte (ou se connecter) avec cette adresse, puis accepter l'invitation.")}</span>
          </p>
        ) : state.kind === "pending" ? (
          <p className="flex items-start gap-3 text-sm">
            <Mail className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            <span>{t("Invitation envoyée à")} <b>{state.email}</b>. {t("{name} aura accès dès qu'il aura créé son compte avec cette adresse et l'aura confirmée. Sa fiche, ses horaires et ses rendez-vous restent les mêmes.", { name })}</span>
          </p>
        ) : (
          <p className="flex items-start gap-3 text-sm">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden="true" />
            <span>
              <b>{t("Pas d'accès pour l'instant.")}</b> {t("{name} apparaît dans l'agenda et peut recevoir des rendez-vous, mais ne peut pas se connecter. Ajoutez son email : il reçoit une invitation et garde sa fiche, ses horaires et ses rendez-vous.", { name })}
            </span>
          </p>
        )}

        {state.kind === "pending" && !editing ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => send(state.email)}>{t("Renvoyer l'invitation")}</Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditing(true)}>{t("Changer l'email")}</Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => send("")}>{t("Annuler l'invitation")}</Button>
          </div>
        ) : null}

        {showForm ? (
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              send(email);
            }}
          >
            <Field label={t("Son email")} htmlFor="access-email" className="min-w-0 flex-1">
              <Input id="access-email" type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.be" />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" loading={pending}>{t("Envoyer l'invitation")}</Button>
              {editing ? <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>{t("Annuler")}</Button> : null}
            </div>
          </form>
        ) : null}
        {msg ? <p className={cn("text-sm", msg.ok ? "text-success" : "text-danger")} role={msg.ok ? "status" : "alert"}>{t(msg.text)}</p> : null}
      </div>
    </Card>
  );
}
