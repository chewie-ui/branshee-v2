"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Lock, Pencil, Unlock } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { setEpisodeClosed } from "@/server/actions/physio";
import { EpisodeEditor, type EpisodeForm } from "./episodes";

/** Barre d'actions d'un épisode : modifier la prescription, rapport PDF, clôturer / rouvrir. */
export function EpisodeActions({ customerId, episodeId, closed, form, canManage }: { customerId: string; episodeId: string; closed: boolean; form: EpisodeForm; canManage: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <ButtonLink href={`/app/clients/${customerId}/episodes/${episodeId}/rapport`} prefetch={false} variant="secondary" icon={<FileText className="size-4" aria-hidden="true" />}>Rapport au prescripteur (PDF)</ButtonLink>
        {canManage ? (
          <>
            <Button variant="ghost" icon={<Pencil className="size-4" aria-hidden="true" />} onClick={() => setEdit((v) => !v)}>Modifier la prescription</Button>
            <Button variant="ghost" loading={pending} icon={closed ? <Unlock className="size-4" aria-hidden="true" /> : <Lock className="size-4" aria-hidden="true" />} onClick={() => start(async () => { const r = await setEpisodeClosed(episodeId, !closed); setMsg(r.ok ? r.message : r.error); router.refresh(); })}>
              {closed ? "Rouvrir l'épisode" : "Clôturer l'épisode"}
            </Button>
          </>
        ) : null}
      </div>
      {msg ? <p className="text-sm text-muted" role="status">{msg}</p> : null}
      {edit ? (
        <Card className="p-5">
          <EpisodeEditor customerId={customerId} episodeId={episodeId} initial={form} onDone={() => { setEdit(false); router.refresh(); }} />
        </Card>
      ) : null}
    </div>
  );
}
