import type { Metadata } from "next";
import { Gift } from "lucide-react";
import { LoyaltyCards } from "@/components/client/loyalty-cards";
import { Card } from "@/components/ui/card";
import { requireClient } from "@/server/client-account";
import { cardsOfUser } from "@/server/loyalty";

export const metadata: Metadata = { title: "Mes cartes de fidélité" };

export default async function MyCards() {
  const user = await requireClient("/espace-client/fidelite");
  const cards = await cardsOfUser(user.id, user.email);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Mes cartes de fidélité</h1>
      {cards.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">
          <Gift className="mx-auto mb-2 size-8" aria-hidden="true" />
          Pas encore de carte. Chez un pro qui a la fidélité, scannez son QR code en caisse : la carte se crée toute seule. Ajoutez-y votre adresse {user.email} et elle apparaîtra ici.
        </Card>
      ) : (
        <LoyaltyCards cards={cards} />
      )}
    </div>
  );
}
