"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Receipt, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { INAMI_KINE_VERSION, amounts, codesFor, inamiCode, shortLabel } from "@/lib/inami-kine";
import { applyDefaultSessionCode, saveConventioned, setSessionCode } from "@/server/actions/physio";

export type SessionView = { id: string; date: string; service: string; code: string };
const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

/**
 * Séances de l'épisode avec leur code de nomenclature INAMI : honoraire, remboursement de la mutuelle
 * et part du patient (selon BIM et convention), totaux de l'épisode.
 */
export function CareSessions({ episodeId, sessions, place, category, defaultCode, bim, conventioned, canManage, canSettings }: { episodeId: string; sessions: SessionView[]; place: string; category: number | null; defaultCode: string; bim: boolean; conventioned: boolean | null; canManage: boolean; canSettings: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const options = codesFor(place, category);
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message ?? "" } : { ok: false, text: r.error ?? "Erreur." });
      router.refresh();
    });
  const conv = conventioned ?? true;
  const rows = sessions.map((s) => {
    const c = inamiCode(s.code);
    return { s, c, a: c ? amounts(c, { bim, conventioned: conv }) : null };
  });
  const sum = (k: "fee" | "refund" | "patient") => Math.round(rows.reduce((t, r) => t + (r.a?.[k] ?? 0), 0) * 100) / 100;
  const fee = sum("fee");
  const refund = sum("refund");
  const patient = sum("patient");
  const missing = sessions.filter((s) => !s.code).length;
  return (
    <Card id="seances">
      <CardHeader
        title="Séances et nomenclature"
        description={`Code INAMI de chaque séance honorée, avec ce que rembourse la mutuelle et ce que paie le patient (${bim ? "patient BIM" : "patient sans intervention majorée"}, tarifs au ${INAMI_KINE_VERSION.split("-").reverse().join("/")}).`}
        action={canManage && missing && defaultCode ? <Button size="sm" variant="secondary" loading={pending} icon={<Wand2 className="size-4" aria-hidden="true" />} onClick={() => run(() => applyDefaultSessionCode(episodeId))}>Code {defaultCode} pour les {missing} sans code</Button> : null}
      />
      {conventioned == null ? (
        <div className="mx-5 mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-surface-muted px-4 py-3 text-sm">
          <span className="min-w-0 flex-1">Êtes-vous conventionné INAMI ? Les remboursements affichés en dépendent.</span>
          {canSettings ? (
            <>
              <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => saveConventioned(true))}>Oui</Button>
              <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => saveConventioned(false))}>Non</Button>
            </>
          ) : <span className="text-muted">À régler par le responsable.</span>}
        </div>
      ) : null}
      {sessions.length === 0 ? (
        <p className="flex items-center gap-2 p-5 text-sm text-muted"><Receipt className="size-4" aria-hidden="true" />Aucune séance honorée depuis la prescription.</p>
      ) : (
        <div className="overflow-x-auto p-5">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Séance</th>
                <th scope="col" className="py-2 pr-3 font-medium">Code</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Honoraire</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Mutuelle</th>
                <th scope="col" className="py-2 text-right font-medium">Patient</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ s, c, a }, i) => (
                <tr key={s.id} className="border-b border-border last:border-0 align-top">
                  <td className="py-2 pr-3"><span className="font-medium tabular-nums">{i + 1}.</span> {s.date}<span className="block text-muted">{s.service}</span></td>
                  <td className="py-2 pr-3">
                    {canManage ? (
                      <Select aria-label={`Code de la séance du ${s.date}`} value={s.code} disabled={pending} onChange={(e) => run(() => setSessionCode(episodeId, s.id, e.target.value || null))} className="h-9 max-w-[18rem] text-sm">
                        <option value="">—</option>
                        {s.code && !options.some((o) => o.code === s.code) ? <option value={s.code}>{s.code}</option> : null}
                        {options.map((o) => <option key={o.code} value={o.code}>{o.code} · {shortLabel(o, 60)}</option>)}
                      </Select>
                    ) : (s.code || "—")}
                    {c ? <span className="mt-1 block max-w-[18rem] text-xs text-muted">{shortLabel(c, 70)}{c.conventionNote ? " (voir art. 4 de la convention)" : ""}</span> : null}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{a ? eur(a.fee) : "—"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{a ? eur(a.refund) : "—"}</td>
                  <td className="py-2 text-right font-medium tabular-nums">{a ? eur(a.patient) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-semibold">
                <td className="py-2 pr-3" colSpan={2}>Total{missing ? ` (${missing} séance${missing > 1 ? "s" : ""} sans code)` : ""}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{eur(fee)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{eur(refund)}</td>
                <td className="py-2 text-right tabular-nums">{eur(patient)}</td>
              </tr>
            </tfoot>
          </table>
          {conventioned === false ? <p className="mt-2 text-xs text-muted">Non conventionné : vos honoraires sont libres ; la part du patient est calculée sur l&apos;honoraire de la convention.</p> : null}
        </div>
      )}
      {msg ? <p className={`px-5 pb-5 text-sm ${msg.ok ? "text-success" : "text-danger"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
    </Card>
  );
}
