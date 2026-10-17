"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { confirmRequest, refuseRequest } from "@/server/actions/appointments";

/** Confirmer / refuser une demande. Le refus peut s'accompagner d'un motif envoyé au client. */
export function RequestActions({ id, expired = false }: { id: string; expired?: boolean }) {
  const [pending, start] = useTransition();
  const [which, setWhich] = useState<"confirm" | "refuse" | null>(null);
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(kind: "confirm" | "refuse") {
    setWhich(kind);
    setError(null);
    start(async () => {
      const res = kind === "confirm" ? await confirmRequest(id) : await refuseRequest(id, reason, expired);
      if (!res.ok) setError(res.error);
    });
  }

  if (expired)
    return (
      <Button size="sm" variant="secondary" loading={pending} onClick={() => run("refuse")}>
        Libérer le créneau
      </Button>
    );

  if (refusing)
    return (
      <div className="w-full space-y-2 sm:w-80">
        <label htmlFor={`reason-${id}`} className="text-sm font-medium">Motif (facultatif, envoyé au client)</label>
        <Textarea id={`reason-${id}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Ex. je suis absent ce jour-là, je vous propose le lendemain à la même heure." />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setRefusing(false)} disabled={pending}>Annuler</Button>
          <Button size="sm" variant="danger" loading={pending} onClick={() => run("refuse")}>Refuser et libérer le créneau</Button>
        </div>
        {error ? <p className="text-xs text-danger" role="alert">{error}</p> : null}
      </div>
    );

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" icon={<X className="size-4" aria-hidden="true" />} disabled={pending} onClick={() => setRefusing(true)}>
          Refuser
        </Button>
        <Button size="sm" icon={<Check className="size-4" aria-hidden="true" />} loading={pending && which === "confirm"} disabled={pending} onClick={() => run("confirm")}>
          Confirmer
        </Button>
      </div>
      {error ? <p className="text-xs text-danger" role="alert">{error}</p> : null}
    </div>
  );
}
