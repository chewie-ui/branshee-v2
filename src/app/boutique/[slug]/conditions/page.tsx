import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicShop } from "@/server/shop";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const s = await publicShop((await params).slug);
  return { title: { absolute: s ? `Conditions de vente · ${s.business.name}` : "Conditions de vente" }, robots: { index: false } };
}

const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;

/**
 * Conditions générales de vente de la boutique d'un professionnel (informations précontractuelles du Code de
 * droit économique, livre VI) : générées à partir de ses réglages et de ses informations légales (app Factures).
 * Le vendeur est le professionnel ; Skydev ne fournit que l'outil.
 */
export default async function ShopTermsPage({ params }: { params: Params }) {
  const { slug } = await params;
  const s = await publicShop(slug);
  if (!s) notFound();
  const v = s.seller;
  const name = v?.legalName || s.business.name;
  const address = v?.street ? `${v.street}, ${v.zip ?? ""} ${v.city ?? ""}`.trim() : s.business.city;
  const st = s.settings;
  const pays = [s.canPayOnline ? "en ligne par carte (paiement sécurisé par Stripe)" : null, st.payOnPickup ? "au retrait" : null, st.payTransfer ? "par virement" : null].filter(Boolean).join(", ");
  return (
    <main className="mx-auto max-w-prose px-4 py-10 text-[15px] leading-relaxed sm:px-6">
      <p className="text-sm"><Link href={`/boutique/${slug}`} className="text-accent hover:underline">← Retour à la boutique</Link></p>
      <h1 className="mt-4 text-3xl font-semibold">Conditions générales de vente</h1>
      <p className="mt-1 text-sm text-muted">Boutique en ligne de {name}</p>

      <div className="mt-8 space-y-6 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
        <section>
          <h2>1. Vendeur</h2>
          <p><strong>{name}</strong>{address ? `, ${address}` : ""}{v?.bce ? ` · N° d'entreprise ${v.bce}` : ""}{v?.vat ? ` · TVA ${v.vat}` : ""}{v?.email ? ` · ${v.email}` : ""}.</p>
          <p>Les commandes passées sur cette boutique sont conclues avec ce vendeur. La boutique est hébergée par Skydev, qui fournit l&apos;outil mais n&apos;est pas partie à la vente.</p>
        </section>
        <section>
          <h2>2. Produits et prix</h2>
          <p>Les produits, leurs caractéristiques et leurs prix sont ceux affichés au moment de la commande. Les prix sont indiqués en euros, TVA comprise{st.delivery ? `, hors frais de livraison (${eur(st.deliveryCents)}${st.freeDeliveryFromCents ? `, offerts dès ${eur(st.freeDeliveryFromCents)}` : ""})` : ""}. Les promotions valent pour la période et dans les limites indiquées.</p>
          <p>Pour les denrées alimentaires, l&apos;information sur les allergènes est disponible sur demande auprès du vendeur avant la commande.</p>
        </section>
        <section>
          <h2>3. Commande</h2>
          <p>La commande est conclue lorsque vous cochez l&apos;acceptation des présentes conditions et validez avec le bouton « Commander », qui implique une obligation de paiement. Un récapitulatif et un lien de suivi vous sont envoyés par email. Le vendeur peut refuser ou annuler une commande en cas d&apos;indisponibilité d&apos;un produit ; vous en êtes alors informé et tout montant payé est remboursé.</p>
        </section>
        <section>
          <h2>4. Paiement</h2>
          <p>Moyens de paiement proposés : {pays || "indiqués lors de la commande"}. Le paiement en ligne est encaissé directement par le vendeur ; ni le vendeur ni Skydev n&apos;ont accès à vos données de carte.</p>
        </section>
        <section>
          <h2>5. Retrait et livraison</h2>
          <ul>
            {st.pickup ? <li>Retrait chez le vendeur{st.pickupNote ? ` : ${st.pickupNote}` : ""}. Un code de retrait peut vous être demandé.</li> : null}
            {st.delivery ? <li>Livraison{st.deliveryNote ? ` : ${st.deliveryNote}` : ""}.</li> : null}
          </ul>
        </section>
        <section>
          <h2>6. Droit de rétractation</h2>
          <p>Si vous êtes un consommateur, vous disposez de 14 jours à compter de la réception d&apos;un produit pour vous rétracter, sans justification, en informant le vendeur par une déclaration claire (par exemple par email). Le vendeur vous rembourse dans les 14 jours, au plus tard après récupération du produit ; les frais de retour sont à votre charge.</p>
          <p>Conformément à l&apos;article VI.53 du Code de droit économique, <strong>ce droit ne s&apos;applique pas</strong> notamment aux denrées alimentaires et autres biens susceptibles de se détériorer ou de se périmer rapidement, aux produits confectionnés selon vos spécifications ou nettement personnalisés (par exemple un sandwich composé à la demande), ni aux biens scellés descellés pour des raisons d&apos;hygiène.</p>
        </section>
        <section>
          <h2>7. Garantie et réclamations</h2>
          <p>Les produits bénéficient de la garantie légale de conformité (2 ans pour les biens de consommation durables). Toute réclamation s&apos;adresse au vendeur{v?.email ? ` (${v.email})` : ""}. Les consommateurs peuvent aussi recourir au Service de médiation pour le consommateur (<a href="https://www.mediationconsommateur.be" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">mediationconsommateur.be</a>).</p>
        </section>
        <section>
          <h2>8. Données personnelles</h2>
          <p>Vos données (nom, email, téléphone, commande) servent à traiter votre commande et, si vous la rejoignez, votre carte de fidélité. Le vendeur en est responsable ; Skydev les héberge pour lui (<Link href="/confidentialite" className="text-accent hover:underline">politique de confidentialité</Link>).</p>
        </section>
        <section>
          <h2>9. Droit applicable</h2>
          <p>Les présentes conditions sont régies par le droit belge, sans priver le consommateur de la protection des règles impératives de son pays de résidence.</p>
        </section>
      </div>
    </main>
  );
}
