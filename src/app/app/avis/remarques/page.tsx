import type { Metadata } from "next";
import { Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { privateFeedback } from "@/server/google-reviews";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Remarques privées" };

/** Ce que les clients ont préféré vous dire en privé. */
export default async function FeedbackPage() {
  const ctx = await requireContext();
  if (!ctx.can("customers.view")) redirect("/app/avis");
  const rows = await privateFeedback(ctx.business.id);
  return (
    <>
      <PageHeader title="Remarques privées" description="Les messages que vos clients vous ont envoyés directement, sans les publier." />
      {rows.length === 0 ? <Card className="p-8 text-center text-sm text-muted">Aucune remarque pour l&apos;instant.</Card> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.name ?? r.email ?? "Client (QR code)"}</span>
                  <span className="inline-flex" aria-label={`${r.feedbackRating} sur 5`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`size-4 ${n <= (r.feedbackRating ?? 0) ? "fill-warning text-warning" : "text-border-strong"}`} aria-hidden="true" />)}</span>
                  <span className="ml-auto text-sm text-muted">{new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric" }).format(r.feedbackAt!)}</span>
                </div>
                <p className="mt-2 max-w-prose whitespace-pre-line text-sm">{r.feedback}</p>
                {r.email ? <a href={`mailto:${r.email}`} className="mt-3 inline-flex text-sm font-medium text-accent hover:text-accent-hover">Répondre par email</a> : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
