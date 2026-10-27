import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppPlaceholder } from "@/components/apps/app-placeholder";
import { ButtonLink } from "@/components/ui/button";
import { APPS } from "@/lib/apps";
import { requireContext } from "@/server/context";

type Params = Promise<{ id: string }>;
const find = (id: string) => APPS.find((a) => a.id === id && a.status === "soon" && a.href === `/app/bientot/${a.id}`);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: find((await params).id)?.name ?? "App" };
}

/** Page commune des apps à venir : ce qu'elles feront, et un moyen de dire qu'on en a besoin. */
export default async function UpcomingApp({ params }: { params: Params }) {
  await requireContext();
  const app = find((await params).id);
  if (!app) notFound();
  const subject = encodeURIComponent(`App ${app.name} : je suis intéressé`);
  return (
    <AppPlaceholder
      app={app}
      title="Arrive bientôt, inclus dans votre abonnement"
      text={`${app.name} rejoindra vos autres apps, sans supplément. Vous en avez besoin maintenant ? Dites-le-nous : les apps les plus demandées sortent en premier, et on peut aussi la construire sur mesure pour vous.`}
      action={<><ButtonLink href={`mailto:info@skydev.be?subject=${subject}`}>J&apos;en ai besoin</ButtonLink><ButtonLink href="/app/sur-mesure" variant="secondary">Sur mesure</ButtonLink></>}
    />
  );
}
