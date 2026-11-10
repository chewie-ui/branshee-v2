"use client";

import { useState, useTransition } from "react";
import { Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { useT } from "@/components/app-locale";
import { saveBusinessCountry } from "@/server/actions/country";

/** Réglages › Entreprise : pays de l'entreprise. Les apps liées aux règles belges ou à l'euro suivent ce choix. */
export function CountryForm({ country, options }: { country: string; options: { code: string; name: string }[] }) {
  const t = useT();
  const [c, setC] = useState(country);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="mt-6" id="pays">
      <CardHeader title={t("Pays de l'entreprise")} description={t("Certaines apps suivent les règles d'un pays (factures, paie, comptabilité belges) : seules celles qui fonctionnent dans votre pays vous sont proposées.")} />
      <form className="space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); setMsg(null); start(async () => { const r = await saveBusinessCountry(c); setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error }); }); }}>
        <Field label={t("Pays")} htmlFor="country">
          <Select id="country" value={c} onChange={(e) => setC(e.target.value)} className="sm:w-72">
            {options.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
          </Select>
        </Field>
        {msg ? <p className={msg.ok ? "rounded-lg bg-success-soft px-3 py-2 text-sm text-success" : "rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"} role={msg.ok ? "status" : "alert"}>{t(msg.text)}</p> : null}
        <Button type="submit" loading={pending} disabled={c === country && !msg} icon={<Globe2 className="size-4" aria-hidden="true" />}>{t("Enregistrer")}</Button>
      </form>
    </Card>
  );
}
