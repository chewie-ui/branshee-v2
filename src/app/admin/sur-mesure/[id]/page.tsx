import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { AdminRequestForm } from "@/components/custom-work/admin-request-form";
import { APPS } from "@/lib/apps";
import { CUSTOM_FEATURES } from "@/lib/custom-work";
import { requireSuperadmin } from "@/server/admin";
import { featuresOf, requestById } from "@/server/custom-work";

export const metadata: Metadata = { title: "Demande sur mesure" };

export default async function AdminCustomRequest({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperadmin();
  const x = await requestById((await params).id);
  if (!x) notFound();
  const feats = await featuresOf(x.businessId);
  const app = x.r.appId ? APPS.find((a) => a.id === x.r.appId)?.name : null;
  return (
    <div className="space-y-4">
      <Link href="/admin/sur-mesure" className="text-sm font-medium text-muted hover:text-text">← Sur mesure</Link>
      <h1 className="text-2xl font-semibold">{x.r.title}</h1>
      <p className="text-sm text-muted">{x.business}{x.name ? ` · ${x.name}` : ""}{x.email ? ` · ${x.email}` : ""}{app ? ` · app ${app}` : " · nouvel outil"}</p>
      <Card className="p-5"><p className="text-sm whitespace-pre-line">{x.r.description}</p></Card>
      <AdminRequestForm
        id={x.r.id}
        businessId={x.businessId}
        initial={{ status: x.r.status, setupCents: x.r.setupCents, monthlyCents: x.r.monthlyCents, reply: x.r.reply ?? "" }}
        catalog={Object.entries(CUSTOM_FEATURES).map(([key, v]) => ({ key, label: v.label }))}
        active={feats.map((f) => ({ key: f.key, monthlyCents: f.monthlyCents }))}
      />
      <Card>
        <CardHeader title="Comment livrer une modif rien que pour ce client" />
        <ol className="list-decimal space-y-1 px-10 pb-5 text-sm text-muted">
          <li>Ajouter une clé dans <code>CUSTOM_FEATURES</code> (src/lib/custom-work.ts).</li>
          <li>Dans le code de l&apos;app : <code>if (await hasCustomFeature(businessId, &quot;clé&quot;))</code> autour de la modif.</li>
          <li>Publier, puis activer la clé ici pour cette entreprise et passer la demande à « Livrée ».</li>
        </ol>
      </Card>
    </div>
  );
}
