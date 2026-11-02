"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { CONTACT_MODES, type ContactMode } from "@/lib/contact-mode";
import { saveContactMode } from "@/server/actions/contact-mode";

/** Réglages › Établissement : comment les visiteurs vous joignent (site, vitrine, widget, API). */
export function ContactModeForm({ mode, note, hasPhone }: { mode: ContactMode; note: string; hasPhone: boolean }) {
  const [m, setM] = useState<ContactMode>(mode);
  const [n, setN] = useState(note);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="mt-6">
      <CardHeader title="Comment vos clients vous joignent" description="S'applique à votre site, votre page, vos vitrines (véhicules…) et au formulaire de contact intégré sur un autre site." />
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => { e.preventDefault(); const fd = new FormData(); fd.set("contactMode", m); fd.set("contactNote", n); start(async () => { const r = await saveContactMode(fd); setMsg(r.ok ? { ok: true, text: r.message ?? "Enregistré." } : { ok: false, text: r.error }); }); }}
      >
        <fieldset className="space-y-2">
          <legend className="sr-only">Mode de contact</legend>
          {(Object.keys(CONTACT_MODES) as ContactMode[]).map((k) => (
            <label key={k} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors duration-150", m === k ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong")}>
              <input type="radio" name="contactMode" value={k} checked={m === k} onChange={() => setM(k)} className="mt-1 size-4 accent-[var(--accent)]" />
              <span>
                <span className="block font-medium">{CONTACT_MODES[k].label}</span>
                <span className="block text-sm text-muted">{CONTACT_MODES[k].desc}</span>
                {k === "phone" && !hasPhone ? <span className="mt-1 block text-xs text-warning">Ajoutez votre téléphone ci-dessus pour choisir cette option.</span> : null}
              </span>
            </label>
          ))}
        </fieldset>
        {m !== "form" ? (
          <Field label="Vos horaires de réponse (affichés aux visiteurs)" htmlFor="contact-note" hint="Ex. : Du lundi au samedi, de 8 h à 18 h.">
            <Input id="contact-note" value={n} maxLength={160} onChange={(e) => setN(e.target.value)} />
          </Field>
        ) : null}
        {msg ? <p className={msg.ok ? "text-sm text-success" : "text-sm text-danger"} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
        <Button type="submit" loading={pending}>Enregistrer</Button>
      </form>
    </Card>
  );
}
