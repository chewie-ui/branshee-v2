"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { CONTACT_MODES, type ContactMode } from "@/lib/contact-mode";
import { saveContactMode } from "@/server/actions/contact-mode";
import { useT } from "@/components/app-locale";

/** Réglages › Établissement : comment les visiteurs vous joignent (site, vitrine, widget, API). */
export function ContactModeForm({ mode, note, hasPhone }: { mode: ContactMode; note: string; hasPhone: boolean }) {
  const t = useT();
  const [m, setM] = useState<ContactMode>(mode);
  const [n, setN] = useState(note);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [phoneFilled, setPhoneFilled] = useState(hasPhone);
  const needsPhone = m === "phone" && !phoneFilled;
  // « Appel uniquement » sans numéro : le champ Téléphone (formulaire Coordonnées, plus haut) est entouré en orange
  // jusqu'à ce qu'il soit rempli.
  useEffect(() => {
    const input = document.getElementById("phone") as HTMLInputElement | null;
    if (!input) return;
    const sync = () => setPhoneFilled(hasPhone || input.value.trim().length > 0);
    sync();
    input.addEventListener("input", sync);
    return () => input.removeEventListener("input", sync);
  }, [hasPhone]);
  useEffect(() => {
    const input = document.getElementById("phone");
    if (!input) return;
    if (needsPhone) input.setAttribute("data-missing", "");
    else input.removeAttribute("data-missing");
    return () => input.removeAttribute("data-missing");
  }, [needsPhone]);
  const goToPhone = () => {
    const input = document.getElementById("phone") as HTMLInputElement | null;
    if (!input) return;
    input.scrollIntoView({ behavior: "smooth", block: "center" });
    input.focus({ preventScroll: true });
  };
  return (
    <Card className="mt-6">
      <CardHeader title={t("Comment vos clients vous joignent")} description={t("S'applique à votre site, votre page, vos vitrines (véhicules…) et au formulaire de contact intégré sur un autre site.")} />
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => { e.preventDefault(); const fd = new FormData(); fd.set("contactMode", m); fd.set("contactNote", n); start(async () => { const r = await saveContactMode(fd); setMsg(r.ok ? { ok: true, text: r.message ?? t("Enregistré.") } : { ok: false, text: r.error }); }); }}
      >
        <fieldset className="space-y-2">
          <legend className="sr-only">{t("Mode de contact")}</legend>
          {(Object.keys(CONTACT_MODES) as ContactMode[]).map((k) => (
            <label key={k} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors duration-150", m === k ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong")}>
              <input type="radio" name="contactMode" value={k} checked={m === k} onChange={() => setM(k)} className="mt-1 size-4 accent-[var(--accent)]" />
              <span>
                <span className="block font-medium">{t(CONTACT_MODES[k].label)}</span>
                <span className="block text-sm text-muted">{t(CONTACT_MODES[k].desc)}</span>
                {k === "phone" && !phoneFilled ? <span className="mt-1 block text-xs text-warning">{t("Ajoutez votre téléphone dans « Coordonnées », plus haut, pour choisir cette option.")}</span> : null}
              </span>
            </label>
          ))}
        </fieldset>
        {m !== "form" ? (
          <Field label={t("Vos horaires de réponse (affichés aux visiteurs)")} htmlFor="contact-note" hint={t("Ex. : Du lundi au samedi, de 8 h à 18 h.")}>
            <Input id="contact-note" value={n} maxLength={160} onChange={(e) => setN(e.target.value)} />
          </Field>
        ) : null}
        {needsPhone ? (
          <div className="flex flex-col gap-3 rounded-xl border border-warning bg-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <p className="text-sm text-warning">{t("Il manque votre numéro de téléphone : remplissez le champ")} <strong>{t("Téléphone")}</strong> {t("entouré en orange dans « Coordonnées », enregistrez, puis revenez ici.")}</p>
            <Button type="button" variant="secondary" onClick={goToPhone} icon={<ArrowUp className="size-4" aria-hidden="true" />} className="shrink-0">{t("Ajouter mon numéro")}</Button>
          </div>
        ) : null}
        {msg && !(needsPhone && !msg.ok) ? <p className={msg.ok ? "text-sm text-success" : "text-sm text-danger"} role={msg.ok ? "status" : "alert"}>{t(msg.text)}</p> : null}
        <Button type="submit" loading={pending}>{t("Enregistrer")}</Button>
      </form>
    </Card>
  );
}
