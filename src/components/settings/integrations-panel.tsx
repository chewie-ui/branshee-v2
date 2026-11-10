"use client";

import { useBrandName } from "@/components/brand-context";

import { useState, useTransition } from "react";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { CopyLink } from "@/components/app/copy-link";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { disconnectGoogleCalendar, regenerateCalendarFeed } from "@/server/actions/integrations";
import { useT } from "@/components/app-locale";

export function GoogleCalendarCard({ configured, allowed, connectedEmail }: { configured: boolean; allowed: boolean; connectedEmail: string | null }) {
  const t = useT();
  const brandName = useBrandName();
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader title={t("Google Agenda")} description={`Vos rendez-vous ${brandName} apparaissent dans votre Google Agenda, et vos événements personnels bloquent les créneaux en ligne.`} />
      <div className="p-5">
        {!configured ? (
          <p className="text-sm text-muted">{t("La synchronisation avec Google Agenda arrive bientôt.")}</p>
        ) : connectedEmail ? (
          <div className="flex flex-wrap items-center gap-3">
            <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
            <p className="flex-1 text-sm">{t("Connecté à")} <span className="font-medium">{connectedEmail}</span>{allowed ? "" : " — synchronisation en pause (forfait Pro requis)"}.</p>
            <Button variant="ghost" size="sm" loading={pending} onClick={() => start(async () => { await disconnectGoogleCalendar(); })}>{t("Déconnecter")}</Button>
          </div>
        ) : (
          <ButtonLink href="/auth/google?intention=agenda" prefetch={false} icon={<CalendarDays className="size-4" aria-hidden="true" />} variant={allowed ? "primary" : "secondary"}>
            {t("Connecter Google Agenda")}
          </ButtonLink>
        )}
      </div>
    </Card>
  );
}

export function CalendarFeedCard({ origin, token }: { origin: string; token: string | null }) {
  const t = useT();
  const [tok, setTok] = useState(token);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader title={t("Flux d'agenda (iCal)")} description={t("Abonnez Apple Calendrier, Outlook ou Google Agenda à vos rendez-vous. Mise à jour automatique (toutes les heures environ selon l'application).")} />
      <div className="space-y-4 p-5 text-sm">
        {tok ? <CopyLink url={`${origin}/ical/${tok}`} /> : null}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" loading={pending} onClick={() => start(async () => { const r = await regenerateCalendarFeed(); setTok(r.token); })}>{tok ? t("Générer un nouveau lien") : t("Créer mon lien")}</Button>
        </div>
        {t ? <p className="text-muted">{t("Ce lien est personnel : il donne accès à vos rendez-vous. Générer un nouveau lien désactive l'ancien.")}</p> : null}
        <details>
          <summary className="cursor-pointer font-medium text-accent">{t("Comment l'ajouter ?")}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>{t("Google Agenda : « Autres agendas » → « + » → « À partir de l'URL », collez le lien.")}</li>
            <li>{t("Apple Calendrier : Fichier → Nouvel abonnement à un calendrier, collez le lien.")}</li>
            <li>{t("Outlook : Ajouter un calendrier → S'abonner à partir du web, collez le lien.")}</li>
          </ul>
        </details>
      </div>
    </Card>
  );
}
