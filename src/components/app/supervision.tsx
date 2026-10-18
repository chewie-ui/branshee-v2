"use client";

import { useEffect, useState, useTransition } from "react";
import { Eye, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { endSupervision, respondSupervision, supervisionStatus } from "@/server/actions/supervision";

type Status = Awaited<ReturnType<typeof supervisionStatus>>;

/**
 * Côté pro : demande d'accès de l'équipe Branshee (accepter / refuser), puis bandeau
 * « supervision en cours » avec un bouton pour y mettre fin. Vérifié toutes les 15 s.
 */
export function SupervisionPrompt() {
  const [status, setStatus] = useState<Status>({ pending: null, active: false });
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      supervisionStatus().then((s) => alive && setStatus(s)).catch(() => {});
    };
    check();
    const t = window.setInterval(check, 15000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  const refresh = async () => setStatus(await supervisionStatus());

  if (status.pending)
    return (
      <div className="fixed inset-x-0 bottom-0 z-[70] p-4 sm:bottom-4 sm:left-auto sm:right-4 sm:w-96 sm:p-0" role="alertdialog" aria-labelledby="sv-title" aria-describedby="sv-desc">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-xl">
          <p id="sv-title" className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-5 text-accent" aria-hidden="true" />L&apos;équipe Branshee demande l&apos;accès</p>
          <p id="sv-desc" className="mt-1 text-sm text-muted">Pour vous aider, un membre de l&apos;équipe souhaite voir votre espace comme vous le voyez. Vous pourrez y mettre fin à tout moment. Sans réponse, la demande expire dans quelques minutes.</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => { await respondSupervision(status.pending!.id, false); await refresh(); })}>Refuser</Button>
            <Button size="sm" loading={pending} onClick={() => start(async () => { await respondSupervision(status.pending!.id, true); await refresh(); })}>Accepter</Button>
          </div>
        </div>
      </div>
    );

  if (status.active)
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm" role="status">
        <Eye className="size-4 shrink-0 text-accent" aria-hidden="true" />
        <span className="flex-1">L&apos;équipe Branshee consulte actuellement votre espace (avec votre accord).</span>
        <Button size="sm" variant="secondary" loading={pending} onClick={() => start(async () => { await endSupervision(); await refresh(); })}>Mettre fin</Button>
      </div>
    );
  return null;
}

/** Côté super-admin, pendant la supervision : rappel permanent et sortie. */
export function ImpersonationBar({ name }: { name: string }) {
  return (
    <div className="sticky top-0 z-[65] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-text px-4 py-2 text-sm text-surface lg:pl-64">
      <Eye className="size-4" aria-hidden="true" />
      <span>Supervision : vous voyez l&apos;espace de <strong>{name}</strong>. Réglages de sécurité du compte bloqués.</span>
      {/* Route serveur (cookies) : vrai chargement de page, pas de navigation client. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/auth/supervision/quitter" className="rounded-md bg-surface/15 px-2 py-0.5 font-medium hover:bg-surface/25">Quitter</a>
    </div>
  );
}
