import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { googleCalendarConnections, members } from "@/db/schema";
import { UpgradeNotice } from "@/components/app/upgrade-notice";
import { CalendarFeedCard, GoogleCalendarCard } from "@/components/settings/integrations-panel";
import { requireContext } from "@/server/context";
import { googleConfigured } from "@/server/google";
import { businessHas } from "@/server/plan";

export const metadata: Metadata = { title: "Intégrations · Réglages" };

const NOTICES: Record<string, { ok: boolean; text: string }> = {
  ok: { ok: true, text: "Google Agenda connecté : vos prochains rendez-vous y sont envoyés." },
  refus: { ok: false, text: "Google n'a pas donné l'accès hors ligne. Réessayez en acceptant toutes les autorisations." },
  erreur: { ok: false, text: "La connexion à Google a échoué. Réessayez." },
};

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const ctx = await requireContext();
  const [[conn], [me], allowed] = await Promise.all([
    db.select({ email: googleCalendarConnections.googleEmail }).from(googleCalendarConnections).where(eq(googleCalendarConnections.userId, ctx.user.id)),
    db.select({ token: members.calendarFeedToken }).from(members).where(eq(members.id, ctx.member.id)),
    businessHas(ctx.business.id, "googleCalendar"),
  ]);
  const notice = NOTICES[(await searchParams).google ?? ""];
  return (
    <div className="space-y-6">
      {notice ? <p className={notice.ok ? "rounded-lg bg-success-soft p-3 text-sm text-success" : "rounded-lg bg-warning-soft p-3 text-sm text-warning"} role="status">{notice.text}</p> : null}
      {!allowed ? <UpgradeNotice feature="Synchronisation Google Agenda" required="pro">Le flux iCal ci-dessous reste disponible avec tous les forfaits.</UpgradeNotice> : null}
      <GoogleCalendarCard configured={googleConfigured()} allowed={allowed} connectedEmail={conn?.email ?? null} />
      <CalendarFeedCard origin={(process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "")} token={me?.token ?? null} />
    </div>
  );
}
