import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireContext } from "@/server/context";
import { notFound } from "next/navigation";
import { isPatientProfession } from "@/lib/terminology";
import { appMetadata } from "@/server/app-locale";

export const generateMetadata = appMetadata("Aide : dossier kiné");

const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "patient",
    title: "1. Créer et identifier un patient",
    body: (
      <>
        <p>Ouvrez la fiche du patient (menu Patients) et remplissez « Identité du patient ». Le NISS est contrôlé (clé modulo 97), chiffré, et ne peut exister que sur une seule fiche : s&apos;il est déjà utilisé, Skydev vous propose de fusionner les deux fiches.</p>
        <p>La date de naissance et le sexe se déduisent du NISS. Une fiche peut rester incomplète (sans NISS, prénom ou date exacte) et être complétée plus tard.</p>
        <p>Dans « Équipe de soins », ajoutez le généraliste, le prescripteur, les spécialistes, l&apos;infirmier, l&apos;aide familiale… Leurs coordonnées sont reprises dans les rapports et courriers.</p>
      </>
    ),
  },
  {
    id: "episode",
    title: "2. Ouvrir un épisode de soins",
    body: (
      <>
        <p>Une prescription correspond à un épisode : onglet Dossier, « Nouvel épisode ». Indiquez la date de prescription, le nombre de séances prescrites et la situation (pathologie courante, liste E, Fa, Fb). Pour E, Fa et Fb, renseignez les dates de l&apos;accord ou de la notification : elles s&apos;affichent dans la synthèse à l&apos;ouverture de la fiche, avec le compteur de séances.</p>
        <p>Choisissez aussi le lieu des séances (cabinet, domicile…) et le code de nomenclature INAMI par défaut. La carte « Séances et nomenclature » de l&apos;épisode liste chaque séance honorée avec son code, l&apos;honoraire, le remboursement de la mutuelle et la part du patient (selon que le patient est BIM, d&apos;après son code CT1, et que vous êtes conventionné). Les tarifs sont ceux de la circulaire INAMI en vigueur.</p>
        <p>Le compteur reprend les rendez-vous honorés depuis la date de prescription. Une alerte apparaît quand les séances prescrites sont dépassées ou quand l&apos;accord se termine dans moins de 14 jours.</p>
      </>
    ),
  },
  {
    id: "dossier",
    title: "3. Remplir le dossier (déroulé OKIDO)",
    body: (
      <>
        <p>Chaque épisode suit le déroulé : anamnèse, examen kinésithérapeutique, diagnostic kiné, plan de traitement, évaluations, séances et consignes, clôture.</p>
        <p>Les sections « Concertations multidisciplinaires » et « Hospitalisations » gardent la trace des échanges avec les autres soignants et des séjours à l&apos;hôpital. Sous chaque donnée, le champ « Codes » accepte des codes ICF (ex. <code>ICF b28015</code>), ICD-10, ICPC-2 ou SNOMED ; le texte libre reste toujours possible.</p>
        <p>La carte « Mesures » enregistre EVA, amplitudes, force (MRC), périmètres et tests (6 minutes, TUG) avec le côté et la date : un tableau montre l&apos;évolution, reprise automatiquement dans les rapports.</p>
        <p>Rien n&apos;est jamais écrasé : chaque modification crée une nouvelle version, avec son auteur et sa date ; une suppression est une version « supprimée ». L&apos;historique s&apos;ouvre sous chaque donnée.</p>
        <p><strong>Confidentielle</strong> : la donnée n&apos;est visible que par son auteur et n&apos;est jamais reprise dans un export, un document ou un partage. <strong>Passive</strong> : la donnée n&apos;est plus d&apos;actualité mais reste utile aux décisions (statut Kmehr « passive ») ; elle n&apos;est plus reprise dans les nouveaux documents.</p>
      </>
    ),
  },
  {
    id: "documents",
    title: "4. Documents INAMI",
    body: (
      <>
        <p>Onglet Dossier, « Documents INAMI », « Nouveau document » : rapport au prescripteur, rapport écrit (continuité des soins), demande de séances supplémentaires, notification Fa / Fb, demande d&apos;accord liste E, rapport de bilan, historique des pathologies, courrier libre.</p>
        <p>Le document est pré-rempli depuis la fiche et le dossier ; ce qui manque est marqué « [à compléter] ». Avant validation, Skydev signale les rubriques obligatoires absentes ou vides (sans bloquer).</p>
        <p>Indiquez une fois votre n° INAMI dans la carte « Documents INAMI » : il figure en en-tête et en signature. Un document validé s&apos;exporte aussi au format Kmehr (XML), le standard belge d&apos;échange, pour l&apos;envoi électronique.</p>
        <p>« Valider et imprimer » verrouille le document. Pour le corriger, « Nouvelle version » : la version validée reste intacte et consultable. Les notifications Fa / Fb et les demandes E accompagnent le formulaire officiel de la mutuelle, elles ne le remplacent pas.</p>
      </>
    ),
  },
  {
    id: "reception",
    title: "4 bis. Boîte de réception",
    body: (
      <>
        <p>Patients, « Boîte de réception » : déposez les rapports reçus (PDF) ou les messages Kmehr (XML). Pour un message Kmehr, Skydev lit le patient et reconnaît sa fiche par le NISS (ou nom et date de naissance).</p>
        <p>Rien n&apos;entre dans un dossier sans votre confirmation. Si l&apos;identité ne correspond pas (NISS d&apos;un autre patient, nom ou date différents), l&apos;intégration est bloquée jusqu&apos;à confirmation explicite. Pour un patient inconnu, « Créer la fiche du patient » la crée depuis le message. Les documents intégrés apparaissent dans le dossier de suivi du patient.</p>
      </>
    ),
  },
  {
    id: "securite",
    title: "5. Accès et sécurité",
    body: (
      <>
        <p>Les grades (Équipe, Grades) contiennent trois droits « Dossier de soins » : lire, écrire, exporter et imprimer. Un secrétariat peut ainsi gérer les fiches sans lire le dossier clinique.</p>
        <p>Chaque ouverture, modification, impression et export d&apos;un dossier est noté dans le journal des accès (Réglages, Journal), exportable en CSV ; l&apos;export du journal est lui-même noté.</p>
        <p>Le verrouillage après inactivité se règle au même endroit (15 minutes conseillées). La session se ferme et le mot de passe est redemandé.</p>
      </>
    ),
  },
  {
    id: "archives",
    title: "6. Archiver, fusionner, exporter",
    body: (
      <>
        <p>« Archiver le dossier » le rend inactif sans rien supprimer : il reste consultable et réactivable à tout moment. « Fusionner avec une autre fiche » regroupe deux fiches du même patient sans perte (rendez-vous, dossier, documents, factures).</p>
        <p>« Exporter le dossier complet (JSON) » produit un fichier lisible avec toutes les données du patient, pour une migration ou une demande d&apos;accès. Le responsable du cabinet peut exporter tous les dossiers d&apos;un coup (Réglages, Journal, « Tous les dossiers »). Chaque export est tracé.</p>
      </>
    ),
  },
];

/** Aide en ligne du dossier kiné (ouvrable dans un nouvel onglet sans fermer le dossier en cours) et format d'export. */
export default async function PhysioHelpPage() {
  const ctx = await requireContext("records.view");
  if (!isPatientProfession(ctx.business.businessType)) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/aide" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text"><ArrowLeft className="size-4" aria-hidden="true" />Aide et support</Link>
      <PageHeader title="Mode d'emploi du dossier kiné" description="Manuel d'utilisation : du premier rendez-vous au rapport de fin de traitement. Imprimable (Ctrl + P)." />
      <nav aria-label="Sommaire" className="mb-6 flex flex-wrap gap-2 text-sm">
        {[...SECTIONS, { id: "format-export", title: "7. Format d'export" }].map((s) => <a key={s.id} href={`#${s.id}`} className="rounded-lg border border-border px-3 py-1.5 hover:bg-surface-muted">{s.title}</a>)}
      </nav>
      <div className="space-y-4">
        {SECTIONS.map((s) => (
          <Card key={s.id} id={s.id} className="scroll-mt-6 space-y-3 p-5 text-[15px] leading-relaxed">
            <h2 className="text-lg font-semibold">{s.title}</h2>
            {s.body}
          </Card>
        ))}
        <Card id="format-export" className="scroll-mt-6 space-y-3 p-5 text-[15px] leading-relaxed">
          <h2 className="text-lg font-semibold">7. Format d&apos;export (JSON)</h2>
          <p>Fichier UTF-8, en clair, champ <code>format</code> = <code>skydev-patient-export</code>, <code>version</code> = 2 (export de tout le cabinet : <code>skydev-practice-export</code>, un tableau <code>patients[]</code> d&apos;objets de même forme). Dates au format ISO 8601. Objets :</p>
          <ul className="list-disc space-y-1 pl-6">
            <li><code>patient</code> : identité (nom, NISS, date de naissance, sexe, langue), mutuelle (nom, n° d&apos;affiliation, <code>ct1</code>, <code>ct2</code>), adresse, prescripteur et généraliste (nom, INAMI), informations générales, date d&apos;archivage.</li>
            <li><code>careTeam[]</code> : rôle (<code>gp</code>, <code>prescriber</code>, <code>specialist</code>, <code>physio</code>, <code>nurse</code>, <code>care_assistant</code>, <code>home_helper</code>, <code>hospital</code>, <code>coordination</code>, <code>other</code>), nom, profession, INAMI, coordonnées.</li>
            <li><code>careEpisodes[]</code> : prescription (date, prescripteur, séances prescrites), <code>pathologyKind</code> (<code>courante</code>, <code>E</code>, <code>Fa</code>, <code>Fb</code>, <code>autre</code>), accord (début, fin), statut, et <code>entries[]</code> : toutes les versions de chaque donnée (<code>key</code> commun aux versions, <code>section</code> : <code>anamnese</code>, <code>examen</code>, <code>diagnostic</code>, <code>plan</code>, <code>evaluation</code>, <code>acte</code>, <code>cloture</code>, <code>version</code>, <code>deleted</code>, <code>lifecycle</code> active / passive, <code>codes</code> [&#123;scheme, code&#125;], contenu, auteur, date) et <code>measures[]</code> (paramètre, valeur, unité, côté, date, suppression éventuelle).</li>
            <li><code>careDocuments[]</code> : toutes les versions des documents INAMI (type, titre, destinataire, statut brouillon / validé, contenu).</li>
            <li><code>appointments[]</code>, <code>notes[]</code>, <code>invoices[]</code>, <code>sharedWithPatient[]</code>.</li>
          </ul>
          <p>Les données confidentielles d&apos;un autre auteur ne sont pas exportées.</p>
        </Card>
      </div>
    </div>
  );
}
