import type { Metadata } from "next";
import { shopOrigin } from "@/server/shop";

export const metadata: Metadata = {
  title: "API pour les sites connectés",
  description: "Reliez un site sur mesure à Skydev : prestations, créneaux, réservations, messages, produits et avis, avec des webhooks signés.",
  alternates: { canonical: "/developpeurs" },
};

function Code({ children }: { children: string }) {
  return <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-100"><code>{children}</code></pre>;
}

const ROUTES: [string, string, string, string][] = [
  ["GET", "/business", "business", "Nom, adresse, téléphone, horaires, liens de réservation et de boutique."],
  ["GET", "/services", "rdv", "Prestations réservables (durée, prix en centimes) et équipe."],
  ["GET", "/slots?serviceId=…&from=2026-11-02&days=7", "rdv", "Créneaux libres par jour (memberId facultatif)."],
  ["POST", "/bookings", "rdv", "Crée une réservation (le créneau est revérifié). Réponse 201 avec manageUrl, 409 si le créneau vient d'être pris."],
  ["POST", "/contacts", "contacts", "Message du formulaire de contact : rangé dans Clients › Messages, fiche client créée."],
  ["GET", "/products", "shop", "Produits en vente en ligne, avec tailles/couleurs et stock, et l'adresse de la boutique."],
  ["GET", "/reviews", "reviews", "Note moyenne et derniers avis."],
];

/** Documentation publique de l'API des sites connectés. */
export default function DevelopersPage() {
  const api = `${shopOrigin()}/api/connect/v1`;
  return (
    <div className="tw mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight">API des sites connectés</h1>
      <p className="mt-3 max-w-prose text-muted">Pour les développeurs qui relient un site sur mesure à Skydev : votre site affiche les prestations, créneaux, produits et avis avec son propre design, et envoie les réservations et les messages directement dans les apps de l&apos;entreprise.</p>

      <h2 className="mt-12 text-xl font-semibold">Sécurité</h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
        <li>La clé (<code>sk_live_…</code>) se crée dans Skydev › Réglages › Connecter un site. Elle n&apos;est affichée qu&apos;une fois ; Skydev n&apos;en garde qu&apos;une empreinte.</li>
        <li>Elle s&apos;utilise <strong className="text-text">uniquement côté serveur</strong> (variable d&apos;environnement). Une requête envoyée depuis un navigateur est refusée.</li>
        <li>Chaque clé n&apos;a que les droits choisis (rdv, contacts, shop, reviews, business) et se révoque en un clic.</li>
        <li>120 requêtes par minute et par clé. HTTPS obligatoire. Réponses JSON : <code>{"{ data }"}</code> ou <code>{"{ error: { code, message } }"}</code>.</li>
        <li>Pour une page publique sans serveur (WordPress, Wix…), utilisez plutôt les widgets à copier-coller : ils ne demandent aucune clé.</li>
      </ul>

      <h2 className="mt-12 text-xl font-semibold">Authentification</h2>
      <Code>{`curl ${api}/services \\\n  -H "Authorization: Bearer $SKYDEV_API_KEY"`}</Code>

      <h2 className="mt-12 text-xl font-semibold">Routes</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-xs text-muted"><tr><th className="px-3 py-2 font-medium">Méthode et chemin</th><th className="px-3 py-2 font-medium">Droit</th><th className="px-3 py-2 font-medium">Description</th></tr></thead>
          <tbody className="divide-y divide-border">
            {ROUTES.map(([m, p, s, d]) => (
              <tr key={p}><td className="px-3 py-2 align-top whitespace-nowrap"><code className="font-semibold">{m}</code> <code>{p}</code></td><td className="px-3 py-2 align-top"><code>{s}</code></td><td className="px-3 py-2 align-top text-muted">{d}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-8 font-semibold">Réserver un créneau</h3>
      <Code>{`curl -X POST ${api}/bookings \\\n  -H "Authorization: Bearer $SKYDEV_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"serviceId":"…","date":"2026-11-02","time":"10:30","firstName":"Marie","lastName":"Dupont","email":"marie@exemple.be","phone":"0470123456","message":"Première visite"}'`}</Code>
      <p className="mt-2 text-sm text-muted">Les prestations qui exigent un paiement en ligne ou une carte en garantie se réservent via le widget (le paiement se fait chez Skydev).</p>

      <h3 className="mt-8 font-semibold">Envoyer un message de contact</h3>
      <Code>{`curl -X POST ${api}/contacts \\\n  -H "Authorization: Bearer $SKYDEV_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"Jean Martin","email":"jean@exemple.be","subject":"Devis","message":"Bonjour, …","pageUrl":"https://monsite.be/contact"}'`}</Code>

      <h2 className="mt-12 text-xl font-semibold">Webhooks</h2>
      <p className="mt-3 text-sm text-muted">Skydev envoie un <code>POST</code> JSON à votre adresse (https) à chaque événement : <code>appointment.created</code>, <code>appointment.cancelled</code>, <code>order.created</code>, <code>contact.created</code> (et <code>test</code> depuis le bouton « Tester »). En cas d&apos;échec, nouvel essai après 1 min, 5 min, 30 min, 2 h puis 12 h. Répondez en 2xx en moins de 8 secondes.</p>
      <p className="mt-2 text-sm text-muted">Chaque envoi porte l&apos;en-tête <code>Skydev-Signature: t=…,v1=…</code> : HMAC-SHA256 de <code>t + &quot;.&quot; + corps brut</code> avec votre secret <code>whsec_…</code>. Vérifiez-le toujours, et refusez les envois de plus de 5 minutes.</p>
      <Code>{`import crypto from "node:crypto";

export function verifySkydev(rawBody, header, secret) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(t + "." + rawBody).digest("hex");
  return parts.v1?.length === expected.length && crypto.timingSafeEqual(Buffer.from(parts.v1, "hex"), Buffer.from(expected, "hex"));
}`}</Code>
      <Code>{`{
  "id": "…",
  "event": "appointment.created",
  "createdAt": "2026-11-02T09:12:00.000Z",
  "data": { "id": "…", "status": "confirmed", "startsAt": "…", "service": "Coupe", "customer": { "name": "Marie Dupont", "email": "…" }, "manageUrl": "…" }
}`}</Code>
      <p className="mt-10 text-sm text-muted">Une question ? <a href="mailto:info@skydev.be" className="font-medium text-accent hover:text-accent-hover">info@skydev.be</a></p>
    </div>
  );
}
