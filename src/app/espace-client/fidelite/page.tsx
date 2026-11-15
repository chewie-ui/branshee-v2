import type { Metadata } from "next";
import { Gift } from "lucide-react";
import { LoyaltyCards } from "@/components/client/loyalty-cards";
import { Card } from "@/components/ui/card";
import { requireClient } from "@/server/client-account";
import { cardsOfUser, joinableLoyalty } from "@/server/loyalty";
import { Avatar } from "@/components/ui/avatar";
import { JoinLoyalty } from "@/components/loyalty/join-loyalty";

export const metadata: Metadata = { title: "Mes cartes de fidélité" };

export default async function MyCards() {
  const user = await requireClient("/espace-client/fidelite");
  const [cards, joinable] = await Promise.all([cardsOfUser(user.id, user.email), user.emailVerifiedAt ? joinableLoyalty(user.id, user.email) : Promise.resolve([])]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Mes cartes de fidélité</h1>
      {joinable.length ? (
        <section className="space-y-3" aria-labelledby="dispo">
          <h2 id="dispo" className="text-lg font-semibold">Cartes à activer</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {joinable.map((j) => (
              <li key={j.businessId}>
                <Card className="flex h-full flex-col gap-3 p-4">
                  <span className="flex items-center gap-3">
                    <Avatar name={j.name} src={j.photoUrl} />
                    <span className="min-w-0"><span className="block truncate font-medium">{j.name}</span><span className="block text-sm text-muted">{j.goal} tampons = {j.reward}</span></span>
                  </span>
                  <p className="text-sm text-muted">Vous y avez déjà commandé. Vos achats payés ou retirés comptent tout de suite.</p>
                  <JoinLoyalty businessId={j.businessId} label="Activer ma carte" busy="Activation…" />
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {cards.length === 0 && joinable.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">
          <Gift className="mx-auto mb-2 size-8" aria-hidden="true" />
          Pas encore de carte. Chez un pro qui a la fidélité, la carte se crée toute seule : en scannant son QR code en caisse, ou avec vos achats sur sa boutique en ligne (dès que la commande est payée ou retirée). Avec l&apos;adresse {user.email}, elle apparaît ici.
        </Card>
      ) : cards.length ? (
        <LoyaltyCards cards={cards} />
      ) : null}
    </div>
  );
}
