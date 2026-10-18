import Link from "next/link";
import { Construction, PowerOff, TriangleAlert } from "lucide-react";
import { Brand } from "@/components/brand";
import type { FeatureStatus } from "@/lib/features";

const COPY: Record<Exclude<FeatureStatus, "active">, { title: string; text: string; icon: typeof Construction }> = {
  maintenance: { title: "En cours d'amélioration", text: "Cette page est en maintenance pour quelques instants. Merci de réessayer un peu plus tard.", icon: Construction },
  error: { title: "Erreur temporaire", text: "Un souci technique nous empêche d'afficher cette page. Notre équipe est dessus.", icon: TriangleAlert },
  disabled: { title: "Page indisponible", text: "Cette page n'est pas disponible pour le moment.", icon: PowerOff },
};

/** Page affichée à la place du contenu quand le super-admin a mis une page en maintenance. */
export function FeatureStatusPage({ status, message }: { status: Exclude<FeatureStatus, "active">; message?: string | null }) {
  const c = COPY[status];
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-16 text-center">
      <Brand />
      <c.icon className="mt-10 size-10 text-muted" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{c.title}</h1>
      <p className="mt-2 max-w-md text-sm text-muted">{message || c.text}</p>
      <Link href="/" className="mt-6 text-sm font-medium text-accent hover:text-accent-hover">Retour à l&apos;accueil</Link>
    </div>
  );
}
