"use client";

import { useBrandName } from "@/components/brand-context";

import { useState, useTransition } from "react";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { CopyLink } from "@/components/app/copy-link";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { disconnectGoogleCalendar, regenerateCalendarFeed } from "@/server/actions/integrations";

export function GoogleCalendarCard({ configured, allowed, connectedEmail }: { configured: boolean; allowed: boolean; connectedEmail: string | null }) {
  const brandName = useBrandName();
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader title="Google Agenda" description={`Vos rendez-vous ${brandName} apparaissent dans votre Google Agenda, et vos événements personnels bloquent les créneaux en ligne.`} />
      <div className="p-5">
        {!configured ? (
          <p className="text-sm text-muted">La connexion Google n&apos;est pas encore configurée sur ce serveur.</p>
        ) : connectedEmail ? (
          <div className="flex flex-wrap items-center gap-3">
            <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
            <p className="flex-1 text-sm">Connecté à <span className="font-medium">{connectedEmail}</span>{allowed ? "" : " — synchronisation en pause (forfait Pro requis)"}.</p>
            <Button variant="ghost" size="sm" loading={pending} onClick={() => start(async () => { await disconnectGoogleCalendar(); })}>Déconnecter</Button>
          </div>
        ) : (
          <ButtonLink href="/auth/google?intention=agenda" prefetch={false} icon={<CalendarDays className="size-4" aria-hidden="true" />} variant={allowed ? "primary" : "secondary"}>
            Connecter Google Agenda
          </ButtonLink>
        )}
      </div>
    </Card>
  );
}

export function CalendarFeedCard({ origin, token }: { origin: string; token: string | null }) {
  const [t, setT] = useState(token);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader title="Flux d'agenda (iCal)" description="Abonnez Apple Calendrier, Outlook ou Google Agenda à vos rendez-vous. Mise à jour automatique (toutes les heures environ selon l'application)." />
      <div className="space-y-4 p-5 text-sm">
        {t ? <CopyLink url={`${origin}/ical/${t}`} /> : null}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" loading={pending} onClick={() => start(async () => { const r = await regenerateCalendarFeed(); setT(r.token); })}>{t ? "Générer un nouveau lien" : "Créer mon lien"}</Button>
        </div>
        {t ? <p className="text-muted">Ce lien est personnel : il donne accès à vos rendez-vous. Générer un nouveau lien désactive l&apos;ancien.</p> : null}
        <details>
          <summary className="cursor-pointer font-medium text-accent">Comment l&apos;ajouter ?</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>Google Agenda : « Autres agendas » → « + » → « À partir de l&apos;URL », collez le lien.</li>
            <li>Apple Calendrier : Fichier → Nouvel abonnement à un calendrier, collez le lien.</li>
            <li>Outlook : Ajouter un calendrier → S&apos;abonner à partir du web, collez le lien.</li>
          </ul>
        </details>
      </div>
    </Card>
  );
}
