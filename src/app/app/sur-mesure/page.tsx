import type { Metadata } from "next";
import { RequestBoard } from "@/components/custom-work/request-board";
import { APPS, appById } from "@/lib/apps";
import { CUSTOM_FEATURES } from "@/lib/custom-work";
import { requireContext } from "@/server/context";
import { featuresOf, requestsOf } from "@/server/custom-work";

const app = appById("sur-mesure");
export const metadata: Metadata = { title: app.name };

/** Sur mesure : demandes de modifs et d'outils propres à l'entreprise, avec prix et suivi. */
export default async function Page() {
  const ctx = await requireContext();
  const manager = ctx.member.isOwner || ctx.can("settings.manage");
  // Demandes et prix : visibles par le responsable seulement.
  const [reqs, feats] = manager ? await Promise.all([requestsOf(ctx.business.id), featuresOf(ctx.business.id)]) : [[], []];
  const names = new Map(APPS.map((a) => [a.id, a.name] as const));
  return (
    <RequestBoard
      canRequest={manager}
      apps={APPS.filter((a) => a.billing === "included" && a.status === "active").map((a) => ({ id: a.id, name: a.name }))}
      features={feats.map((x) => ({ label: CUSTOM_FEATURES[x.key]?.label ?? x.key, monthly: x.monthlyCents }))}
      requests={reqs.map((r) => ({ id: r.id, title: r.title, description: r.description, app: r.appId ? (names.get(r.appId as never) ?? null) : null, status: r.status, setupCents: r.setupCents, monthlyCents: r.monthlyCents, reply: r.reply, createdAt: r.createdAt.toISOString() }))}
    />
  );
}
