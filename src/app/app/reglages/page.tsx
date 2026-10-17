import type { Metadata } from "next";
import { Bell, Building2, CalendarCog, CreditCard, History, Plug, ReceiptText, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Réglages" };

const SECTIONS = [
  { icon: Building2, title: "Établissement", description: "Nom, métier, adresse, coordonnées, réseaux sociaux, lien public." },
  { icon: CalendarCog, title: "Règles de réservation", description: "Durée des créneaux, temps de battement, délai minimum, confirmation automatique, liste d'attente." },
  { icon: CreditCard, title: "Paiements", description: "Paiement en ligne, acomptes, politique d'annulation, moyens acceptés sur place." },
  { icon: Bell, title: "Notifications", description: "Rappels aux clients, messages personnalisés, emails reçus, SMS et WhatsApp." },
  { icon: Plug, title: "Intégrations", description: "Google Agenda, flux iCal pour Apple Agenda et Outlook." },
  { icon: ReceiptText, title: "Abonnement", description: "Forfait, modules actifs, collaborateurs, factures, parrainage." },
  { icon: History, title: "Journal d'activité", description: "Qui a fait quoi dans l'établissement." },
  { icon: TriangleAlert, title: "Zone sensible", description: "Mettre l'établissement en pause ou le supprimer." },
];

export default async function SettingsPage() {
  await requireContext("settings.manage");
  return (
    <>
      <PageHeader title="Réglages" description="Tout ce qu'on règle une fois, rangé par thème. Ces écrans arrivent dans les prochaines étapes de la v2." />
      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Card key={s.title} className="flex gap-4 p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted" aria-hidden="true">
              <s.icon className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold">{s.title}</h2>
              <p className="mt-0.5 text-sm text-muted">{s.description}</p>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
