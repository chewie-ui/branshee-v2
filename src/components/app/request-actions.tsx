"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmRequest, refuseRequest } from "@/server/actions/appointments";

export function RequestActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [which, setWhich] = useState<"confirm" | "refuse" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(kind: "confirm" | "refuse") {
    setWhich(kind);
    setError(null);
    start(async () => {
      const res = kind === "confirm" ? await confirmRequest(id) : await refuseRequest(id);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" icon={<X className="size-4" aria-hidden="true" />} loading={pending && which === "refuse"} disabled={pending} onClick={() => run("refuse")}>
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
