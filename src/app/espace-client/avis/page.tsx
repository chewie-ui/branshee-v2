import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { DeleteReviewButton } from "@/components/client/delete-review";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { listMyReviews, requireClient } from "@/server/client-account";

export const metadata: Metadata = { title: "Mes avis" };

export default async function MyReviews() {
  const user = await requireClient("/espace-client/avis");
  const list = await listMyReviews(user.id);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Mes avis</h1>
      {list.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">Vous n&apos;avez pas encore laissé d&apos;avis. Après un rendez-vous, partagez votre expérience depuis l&apos;historique.</Card>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {list.map((r) => (
              <li key={r.id} className="space-y-1 px-5 py-4 text-sm">
                <div className="flex items-center gap-3">
                  <Link href={`/${r.business.slug}`} className="font-medium hover:text-accent">{r.business.name}</Link>
                  <span className="flex text-warning" aria-label={`${r.rating} sur 5`}>
                    {Array.from({ length: 5 }, (_, i) => <Star key={i} className={cn("size-3.5", i < r.rating ? "fill-current" : "opacity-30")} aria-hidden="true" />)}
                  </span>
                  <span className="ml-auto"><DeleteReviewButton id={r.id} /></span>
                </div>
                {r.comment ? <p className="text-muted">{r.comment}</p> : null}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
