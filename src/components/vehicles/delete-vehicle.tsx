"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteVehicle } from "@/server/actions/vehicles";
import { useT } from "@/components/app-locale";

/** Suppression définitive (fiche et photos), après confirmation. Un véhicule vendu peut plutôt passer en « Vendu ». */
export function DeleteVehicle({ id, title }: { id: string; title: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-2 pb-4">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Supprimer définitivement « ${title} » et ses photos ? Pour le retirer de la vitrine sans le perdre, passez-le plutôt en « Vendu ».`)) return;
          start(async () => { const r = await deleteVehicle(id); if (!r.ok) return setErr(r.error); router.push("/app/vehicules"); });
        }}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-50"
      >
        <Trash2 className="size-4" aria-hidden="true" />{t("Supprimer le véhicule")}
      </button>
      {err ? <p className="text-sm text-danger" role="alert">{err}</p> : null}
    </div>
  );
}
