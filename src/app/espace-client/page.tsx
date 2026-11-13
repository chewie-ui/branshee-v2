import type { Metadata } from "next";
import { currentBrand } from "@/server/brand";
import Link from "next/link";
import { CalendarDays, ChevronRight, Clock, Gift, ShoppingBag, Star } from "lucide-react";
import { cardsOfUser } from "@/server/loyalty";
import { LoyaltyCards } from "@/components/client/loyalty-cards";
import { DirectorySearch } from "@/components/directory/directory-search";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { formatDay, formatTime } from "@/lib/time";
import { listClientAppointments, listMyOrders, listMyReviews, requireClient } from "@/server/client-account";
import { pickupCode } from "@/server/shop";

// Page du même segment que le layout : le modèle de titre du layout ne s'applique pas, on donne le titre complet.
export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: `Mon espace · ${(await currentBrand()).name}` } };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** Accueil de l'espace client : les apps (comme côté pro), puis ce qui arrive bientôt. */
export default async function ClientHome() {
  const user = await requireClient();
  const [list, myReviews, cards, orders] = await Promise.all([listClientAppointments(user.id), listMyReviews(user.id), cardsOfUser(user.id, user.email), listMyOrders(user.email)]);
  const now = new Date();
  const upcoming = list.filter((a) => a.startsAt > now && a.status !== "cancelled").sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const openOrders = orders.filter((o) => !["done", "cancelled"].includes(o.status));
  const rewards = cards.filter((c) => c.stamps >= c.goal).length;

  const apps = [
    { href: "/espace-client/rendez-vous", icon: CalendarDays, name: "Rendez-vous", stat: upcoming.length ? plural(upcoming.length, "rendez-vous à venir", "rendez-vous à venir") : list.length ? "Aucun à venir" : "Réservez chez un pro, 24 h/24" },
    { href: "/espace-client/fidelite", icon: Gift, name: "Fidélité", stat: rewards ? plural(rewards, "récompense débloquée", "récompenses débloquées") : cards.length ? plural(cards.length, "carte", "cartes") : "Scannez le QR en caisse" },
    { href: "/espace-client/commandes", icon: ShoppingBag, name: "Commandes", stat: openOrders.length ? plural(openOrders.length, "commande en cours", "commandes en cours") : orders.length ? plural(orders.length, "commande", "commandes") : "Commandez, passez récupérer" },
    { href: "/espace-client/avis", icon: Star, name: "Mes avis", stat: myReviews.length ? plural(myReviews.length, "avis laissé", "avis laissés") : "Partagez votre expérience" },
  ];
  const next = upcoming[0];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Bonjour {user.fullName.split(" ")[0]}</h1>

      <section aria-label="Mes apps">
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {apps.map((a) => (
            <li key={a.href}>
              <Link href={a.href} className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors duration-150 hover:border-border-strong hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><a.icon className="size-5" aria-hidden="true" /></span>
                <span>
                  <span className="block font-semibold">{a.name}</span>
                  <span className="mt-0.5 block text-sm text-muted">{a.stat}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {next ? (
        <section className="space-y-3" aria-labelledby="prochain">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="prochain" className="text-lg font-semibold">Prochain rendez-vous</h2>
            <Link href="/espace-client/rendez-vous" className="text-sm font-medium text-accent hover:text-accent-hover">Tout voir</Link>
          </div>
          <Link href={`/r/${next.token}`} className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 text-sm transition-colors duration-150 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <Avatar name={next.business.name} src={next.business.photoUrl} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{next.serviceName ?? "Rendez-vous"} · {next.business.name}</span>
              <span className="flex items-center gap-1.5 text-muted"><Clock className="size-4" aria-hidden="true" />{cap(formatDay(next.startsAt, next.business.timezone, "EEEE d MMMM"))} à {formatTime(next.startsAt, next.business.timezone)}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
          </Link>
        </section>
      ) : null}

      {openOrders.length ? (
        <section className="space-y-3" aria-labelledby="commandes">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="commandes" className="text-lg font-semibold">Commandes en cours</h2>
            <Link href="/espace-client/commandes" className="text-sm font-medium text-accent hover:text-accent-hover">Tout voir</Link>
          </div>
          <Card>
            <ul className="divide-y divide-border">
              {openOrders.slice(0, 3).map((o) => (
                <li key={o.id}>
                  <Link href={`/commande/${o.token}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
                    <span className="min-w-0 flex-1"><span className="block font-medium">{o.business.name}</span><span className="block text-muted">Commande n° {o.number}{o.status === "ready" ? " · prête à retirer" : o.status === "pending_payment" ? " · paiement en attente" : ""}</span></span>
                    {o.fulfilment === "pickup" && o.status !== "pending_payment" ? <span className="font-mono text-lg font-bold tracking-widest" aria-label={`Code de retrait ${pickupCode(o.token)}`}>{pickupCode(o.token)}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {cards.length ? (
        <section className="space-y-3" aria-labelledby="cartes">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="cartes" className="text-lg font-semibold">Mes cartes de fidélité</h2>
            <Link href="/espace-client/fidelite" className="text-sm font-medium text-accent hover:text-accent-hover">Tout voir</Link>
          </div>
          <LoyaltyCards cards={cards.slice(0, 3)} />
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="trouver">
        <h2 id="trouver" className="text-lg font-semibold">Trouver un pro</h2>
        <DirectorySearch />
      </section>
    </div>
  );
}
