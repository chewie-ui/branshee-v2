import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { formQuestions, services } from "@/db/schema";
import { FormQuestionsEditor } from "@/components/booking-page/editors";
import { IntakeQuestionCard, NewIntakeQuestion } from "@/components/services/intake-editor";
import { PageHeader } from "@/components/ui/page-header";
import { ServiceTabs } from "@/components/services/service-tabs";
import { requireContext } from "@/server/context";
import { listIntake } from "@/server/intake";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Questions avant réservation");

export default async function IntakePage() {
  const t = await appT();
  const ctx = await requireContext("services.manage");
  const [questions, svc, formQs] = await Promise.all([
    listIntake(ctx.business.id),
    db.select({ id: services.id, name: services.name, isActive: services.isActive }).from(services).where(eq(services.businessId, ctx.business.id)).orderBy(asc(services.position), asc(services.name)),
    ctx.can("forms.manage") ? db.select().from(formQuestions).where(eq(formQuestions.businessId, ctx.business.id)).orderBy(asc(formQuestions.position)) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader title={t("Prestations")} />
      <ServiceTabs />
      <div className="mx-auto max-w-3xl space-y-4">
        {formQs ? <FormQuestionsEditor initial={formQs.map((q) => ({ label: q.label, type: q.type, isRequired: q.isRequired, options: q.options, serviceIds: q.serviceIds }))} services={svc} /> : null}
        <div className="pt-4">
          <h2 className="text-lg font-semibold">{t("Orienter le client vers les bonnes prestations")}</h2>
          <p className="mt-1 text-sm text-muted">
            {t("Ces questions sont posées sur votre page de réservation, avant le choix de la prestation. Selon la réponse, le client ne voit que les prestations qui le concernent. Exemple : « Êtes-vous enceinte ? » → Oui : kiné prénatale uniquement.")}
          </p>
        </div>
        {questions.map((q, i) => (
          <IntakeQuestionCard key={q.id} question={q} services={svc} index={i} total={questions.length} />
        ))}
        {svc.length === 0 ? <p className="text-sm text-muted">{t("Créez d'abord vos prestations.")}</p> : <NewIntakeQuestion services={svc} first={questions.length === 0} />}
      </div>
    </>
  );
}
