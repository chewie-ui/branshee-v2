import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { Faq } from "@/components/site/faq";
import { PricingTable } from "@/components/site/pricing";
import { Section, SectionTitle } from "@/components/site/section";
import { ADDONS, FEATURE_LABELS, FEATURES, LIMITS, PLANS, type Plan, atLeast, eur } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Tarifs",
  description: "30 jours d'essai gratuit, puis Pro à 23 €/mois ou Pro+ à 59,50 €/mois TVAC. Sans engagement, 0 % de commission. Comparez les forfaits Branshee.",
  alternates: { canonical: "/tarifs" },
};

const PLANS_ORDER: Plan[] = ["pro", "pro_plus"];
const n = (v: number) => (Number.isFinite(v) ? String(v) : "Illimité");

const ROWS: { label: string; value: (p: Plan) => string | boolean }[] = [
  { label: "Rendez-vous", value: () => "Illimités" },
  { label: "Commission sur les réservations", value: () => "0 %" },
  { label: "Prestations actives", value: (p) => n(LIMITS.services[p]) },
  { label: "Confirmation automatique des réservations en ligne", value: (p) => (Number.isFinite(LIMITS.autoConfirmUpTo[p]) ? `${LIMITS.autoConfirmUpTo[p]} / mois, puis à confirmer` : "Illimitée") },
  { label: "Collaborateurs inclus", value: (p) => (p === "free" ? false : `${LIMITS.collaborators[p]} (+${ADDONS.seat.monthly} € TVAC/mois le siège)`) },
  { label: "Questions avant la réservation", value: (p) => String(LIMITS.formQuestions[p]) },
  { label: "SMS ou WhatsApp inclus par mois", value: (p) => (LIMITS.smsIncluded[p] ? String(LIMITS.smsIncluded[p]) : false) },
  { label: "Historique des rendez-vous visible", value: (p) => (Number.isFinite(LIMITS.historyDays[p]) ? `${LIMITS.historyDays[p]} derniers jours` : "Complet") },
  { label: "Paiement en ligne et politique d'annulation", value: () => true },
  { label: "Dossiers clients chiffrés", value: () => true },
  ...(Object.keys(FEATURES) as (keyof typeof FEATURES)[]).map((f) => ({ label: FEATURE_LABELS[f] + (f === "customUrl" ? ` (ou option ${ADDONS.customUrl.monthly} € TVAC/mois)` : ""), value: (p: Plan) => atLeast(p, FEATURES[f]) })),
];

const FAQ = [
  { q: "Puis-je changer de forfait à tout moment ?", a: "Oui. Le changement est immédiat et calculé au prorata. En passant à un forfait inférieur, ce qui dépasse est désactivé, jamais supprimé : vous le retrouvez si vous revenez." },
  { q: "Le forfait est-il lié à mon compte ou à mon établissement ?", a: "À l'établissement. Si vous gérez deux cabinets, chacun a son propre forfait." },
  { q: "Comment fonctionne l'essai gratuit ?", a: "30 jours de forfait Pro, sans carte bancaire, pour votre premier établissement. Vous pouvez vous abonner à tout moment pendant l'essai. Sans abonnement, la réservation en ligne se ferme à la fin de l'essai ; vos données sont conservées." },
  { q: "Comment se passe le paiement ?", a: "Par carte, via Stripe, chaque mois ou chaque année. Les factures (avec numéro de TVA si besoin) sont disponibles dans votre espace." },
  { q: "Y a-t-il des frais sur les paiements de mes clients ?", a: "Branshee ne prend aucune commission. Seuls les frais habituels de Stripe s'appliquent quand vos clients paient en ligne." },
];

export default function PricingPage() {
  return (
    <>
      <Section>
        <SectionTitle title="Des prix simples. Pas de surprises." sub="30 jours d'essai gratuit du forfait Pro, sans carte bancaire. Sans engagement, sans commission, sans frais cachés." />
        <PricingTable />
      </Section>
      <Section muted>
        <SectionTitle title="Comparer les forfaits" />
        <div className="overflow-x-auto rounded-2xl border border-border bg-background">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Comparatif détaillé des forfaits</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="px-5 py-4 text-left font-medium text-muted">Fonctionnalité</th>
                {PLANS_ORDER.map((p) => (
                  <th key={p} scope="col" className="px-5 py-4 text-left">
                    <span className="block font-semibold">{PLANS[p].label}</span>
                    <span className="font-normal text-muted">{eur(PLANS[p].monthly)} TVAC/mois</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ROWS.map((r) => (
                <tr key={r.label}>
                  <th scope="row" className="px-5 py-3 text-left font-normal">{r.label}</th>
                  {PLANS_ORDER.map((p) => {
                    const v = r.value(p);
                    return (
                      <td key={p} className="px-5 py-3">
                        {v === true ? <Check className="size-4 text-success" aria-label="Inclus" /> : v === false ? <Minus className="size-4 text-muted" aria-label="Non inclus" /> : v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section>
        <SectionTitle title="Questions sur les tarifs" />
        <div className="mx-auto max-w-3xl"><Faq items={FAQ} /></div>
      </Section>
    </>
  );
}
