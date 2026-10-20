import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, BellRing, CalendarCheck, CalendarDays, Check, ClipboardList, Clock, CreditCard, Globe, LayoutTemplate, MessageCircle, Palette, Scissors, ShieldCheck, Sparkles, Star, Users, X,
} from "lucide-react";
import { FeatureStatusPage } from "@/components/feature-status";
import { Faq } from "@/components/site/faq";
import { PricingTable } from "@/components/site/pricing";
import { Section, SectionTitle } from "@/components/site/section";
import { featureStatus } from "@/server/features";
import { featuredBusinesses } from "@/server/site";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { customHostOf } from "@/lib/custom-host";
import PublicBusinessPage from "@/app/(public)/[slug]/page";
import { businessSlugForDomain } from "@/server/site-builder";

export const metadata: Metadata = {
  title: { absolute: "Agenda en ligne gratuit et prise de rendez-vous 24 h/24 | Branshee" },
  description: "Agenda en ligne gratuit : réservations 24 h/24, rappels anti-absence, 0 % de commission, widget pour votre site. Pro à 19 €/mois, sans engagement.",
  alternates: { canonical: "/" },
};

const COMPARE = [
  { name: "Logiciels de réservation classiques", price: "30 à 70 €/mois", desc: "Facturés dès le premier jour, fonctionnalités clés en option payante." },
  { name: "Plateformes à commission", price: "Un % sur chaque rendez-vous", desc: "Plus vous travaillez, plus vous payez. Vos clients appartiennent à la plateforme, qui leur montre vos concurrents." },
  { name: "Branshee", price: "0 € pour commencer · 19 €/mois en Pro", desc: "Tout inclus, 0 % de commission. Votre marque en avant, et vos clients restent vos clients.", highlight: true },
];

const STACK = [
  { old: "Le cahier de rendez-vous", now: "Un agenda en ligne que vos clients remplissent eux-mêmes, 24 h/24." },
  { old: "WhatsApp et les appels", now: "Des confirmations et rappels envoyés automatiquement." },
  { old: "Les allers-retours pour trouver un créneau", now: "Vos vraies disponibilités, visibles en temps réel." },
  { old: "Le fichier Excel des clients", now: "Des dossiers clients avec historique et notes de suivi privées." },
  { old: "Le site web à 500 €", now: "Un site vitrine publié en un clic, ou un widget sur le vôtre." },
  { old: "Le terminal pour les acomptes", now: "Le paiement en ligne Stripe : acompte, carte en garantie, annulation encadrée." },
];

const FEATURES = [
  {
    tag: "Votre image",
    title: "Une page de réservation à votre image, ou directement sur votre site",
    desc: "Couleurs, polices, logo, galerie : votre page ressemble à votre marque, pas à la nôtre. Vous avez déjà un site ? Intégrez le calendrier en copiant une ligne de code. Vous n'en avez pas ? Branshee vous en génère un.",
    items: ["Personnalisation complète : couleurs, polices, logo, galerie", "Widget à intégrer sur votre site (copier-coller)", "Site vitrine généré, publié en un clic", "Réservation sans compte client, avec QR code à imprimer"],
    icon: Palette,
  },
  {
    tag: "Automatisation",
    title: "Les rendez-vous se gèrent tout seuls. Les absents paient.",
    desc: "Vos clients choisissent leur créneau, reçoivent une confirmation immédiate puis un rappel la veille. Pour les habitués du lapin : carte en garantie ou acompte via Stripe, l'absence devient facturable.",
    items: ["Confirmations automatiques, rappel par email, SMS ou WhatsApp", "Paiement en ligne, carte en garantie, politique d'annulation", "Questions avant la réservation (première visite, allergies…)", "Synchronisation Google Agenda : jamais de double réservation"],
    icon: BellRing,
  },
  {
    tag: "Équipe",
    title: "Votre équipe, vos règles",
    desc: "Invitez vos collaborateurs. Créez des grades et décidez précisément qui peut faire quoi : horaires, congés, prestations, dossiers. Le journal d'activité montre qui a fait quoi, et quand.",
    items: ["Chaque collaborateur avec son propre accès", "Grades et permissions sur mesure", "Horaires et congés par personne, planning commun ou individuel", "Plusieurs établissements et cours collectifs"],
    icon: Users,
  },
];

const INCLUDED = [
  { icon: CalendarDays, title: "Agenda clair", desc: "Vue jour et semaine, rendez-vous créés en deux clics, créneaux bloqués d'un geste." },
  { icon: BellRing, title: "Rappels automatiques", desc: "La veille du rendez-vous, par email, SMS ou WhatsApp. Moins d'oublis, moins de trous." },
  { icon: ClipboardList, title: "Dossiers clients", desc: "Fiches, notes de suivi chiffrées, historique complet des visites." },
  { icon: Scissors, title: "Prestations", desc: "Prix, durée fixe ou variable, photo, catégorie, prestations réservées à certains clients." },
  { icon: Users, title: "Cours collectifs", desc: "Séances récurrentes ou ponctuelles, places limitées, liste d'attente." },
  { icon: Clock, title: "Disponibilités fines", desc: "Horaires par semaine ou par personne, congés, battements, délais de réservation." },
  { icon: CreditCard, title: "Paiement en ligne", desc: "Stripe intégré : prépaiement, carte en garantie, frais d'annulation automatiques." },
  { icon: Palette, title: "Personnalisation", desc: "Thèmes, couleurs, polices, sections, galerie : votre page, votre marque." },
  { icon: Globe, title: "Widget intégrable", desc: "Le calendrier s'installe sur WordPress, Wix, Squarespace ou un site sur mesure." },
  { icon: LayoutTemplate, title: "Mon site", desc: "Un site vitrine généré pour vous, publié en un clic, sans agence." },
  { icon: Star, title: "Avis clients", desc: "Seuls vos vrais clients peuvent laisser un avis, après leur rendez-vous." },
  { icon: ShieldCheck, title: "Équipe et permissions", desc: "Grades sur mesure, journal d'activité, double authentification." },
];

const STEPS = [
  { title: "Créez votre compte gratuit", desc: "Deux minutes, sans carte bancaire. Indiquez votre métier : kiné, coiffure, coaching, bien-être, tatouage…" },
  { title: "Ajoutez vos prestations et horaires", desc: "Prix, durées, planning de la semaine, congés. Une visite guidée vous montre où cliquer." },
  { title: "Partagez votre lien", desc: "Sur Instagram, WhatsApp, Google, votre site, ou en QR code au cabinet. Vos clients réservent, vous êtes prévenu." },
];

const JOBS = [
  { name: "Kinés et paramédicaux", desc: "Un agenda clair, des rappels automatiques, moins de rendez-vous manqués." },
  { name: "Coiffeurs et barbiers", desc: "Le carnet de rendez-vous qui se remplit pendant que vous coupez." },
  { name: "Coachs sportifs", desc: "Séances individuelles et cours collectifs, réservés et payés en ligne." },
  { name: "Thérapeutes et bien-être", desc: "Massages, soins, consultations, avec dossiers et notes de suivi." },
  { name: "Tatoueurs", desc: "Acompte à la réservation, questions sur le projet avant la séance." },
  { name: "Manucure et beauté", desc: "Une page élégante à vos couleurs, réservable depuis Instagram." },
  { name: "Formateurs et ateliers", desc: "Sessions de groupe à dates fixes ou récurrentes, places gérées toutes seules." },
  { name: "Photographes et créatifs", desc: "Vos créneaux de séance réservés sans messages interminables." },
];

const FAQ = [
  { q: "Est-ce vraiment gratuit ? Où est le piège ?", a: "Il n'y en a pas. Le forfait Amateur est gratuit pour toujours, sans carte bancaire : rendez-vous illimités, 5 prestations, confirmations automatiques et votre page de réservation. Quand votre activité grandit, le forfait Pro à 19 €/mois débloque les rappels automatiques, la synchronisation Google Agenda et les prestations illimitées." },
  { q: "Branshee prend-il une commission sur mes réservations ?", a: "Non, jamais. Branshee fonctionne avec un abonnement fixe. Tout ce que paient vos clients vous revient, et vos clients restent vos clients : jamais démarchés, jamais redirigés vers d'autres professionnels." },
  { q: "Que se passe-t-il au-delà de 20 réservations par mois en gratuit ?", a: "Rien n'est bloqué. Vos clients peuvent toujours réserver ; au-delà de 20 réservations en ligne dans le mois, les suivantes arrivent « à confirmer » dans votre espace au lieu d'être confirmées automatiquement." },
  { q: "Combien de temps faut-il pour être prêt ?", a: "Moins de 10 minutes pour la plupart des professionnels : compte, prestations, horaires, puis partage du lien. Aucune compétence technique nécessaire." },
  { q: "Mes clients doivent-ils créer un compte ou installer une application ?", a: "Non. Ils réservent en 30 secondes depuis leur téléphone ou leur ordinateur, avec leur nom, leur email et leur téléphone. Le compte client est facultatif." },
  { q: "Puis-je intégrer le calendrier sur mon propre site ?", a: "Oui. Copiez une ligne de code (WordPress, Wix, Squarespace, Webflow, site sur mesure) : vos clients réservent sans quitter votre site. Sans site, le forfait Pro+ vous en génère un." },
  { q: "Comment Branshee réduit-il les rendez-vous manqués ?", a: "Trois mécanismes : un rappel automatique la veille (email, SMS ou WhatsApp), une politique d'annulation que vous choisissez, et le paiement en ligne via Stripe — acompte ou carte en garantie — pour que les absences ne soient plus à votre charge." },
  { q: "Les dossiers de mes patients sont-ils protégés ?", a: "Oui. Les notes de suivi et les documents sont chiffrés au repos, l'accès se règle par grade au sein de votre équipe, et l'équipe Branshee ne peut voir votre espace qu'avec votre accord explicite." },
  { q: "Puis-je arrêter à tout moment ?", a: "Oui, sans engagement ni frais cachés : résiliation en un clic. Vous gardez l'accès jusqu'à la fin de la période payée, puis vous repassez au forfait gratuit sans rien perdre." },
];

export default async function HomePage() {
  // Domaine personnalisé d'un pro (« Mon site ») : sa page s'affiche à la racine de son domaine.
  const custom = customHostOf((await headers()).get("host"));
  if (custom) {
    const slug = await businessSlugForDomain(custom);
    if (!slug) notFound();
    return PublicBusinessPage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });
  }
  const gate = await featureStatus("home");
  if (gate.status !== "active") return <FeatureStatusPage status={gate.status} message={gate.message} />;
  const featured = await featuredBusinesses(6);

  return (
    <>
      {/* Accroche */}
      <section className="overflow-hidden border-b border-border bg-surface">
        <div className="mx-auto grid grid-cols-1 max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-sm font-medium text-accent-soft-foreground">
              <Sparkles className="size-4" aria-hidden="true" />
              Gratuit pour commencer · Sans carte bancaire
            </p>
            <h1 className="mt-6 text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
              Créez votre agenda, vos clients réservent en ligne.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">Vos clients réservent seuls, 24 h/24, pendant que vous travaillez. En ligne en 10 minutes, gratuit pour démarrer, 19 € quand ça décolle.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/inscription" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-accent px-6 text-base font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover">
                Commencer gratuitement
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/tarifs" className="inline-flex h-12 items-center justify-center rounded-lg border border-border-strong bg-surface px-6 text-base font-medium transition-colors hover:bg-surface-muted">
                Voir les tarifs
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              {["Sans carte bancaire", "0 % de commission", "Sans engagement"].map((c) => (
                <li key={c} className="inline-flex items-center gap-1.5"><Check className="size-4 text-success" aria-hidden="true" />{c}</li>
              ))}
            </ul>
            <p className="mt-6 text-sm">
              <Link href="/annuaire" className="font-medium text-accent hover:text-accent-hover">Vous cherchez à prendre rendez-vous chez un pro ? →</Link>
            </p>
          </div>

          {/* Aperçu (illustration de l'interface de réservation) */}
          <div aria-hidden="true" className="relative mx-auto w-full max-w-md">
            <div className="rounded-2xl border border-border bg-background p-5 shadow-xl">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">CH</span>
                <div>
                  <p className="font-semibold">Cabinet Horizon</p>
                  <p className="text-sm text-muted">Kinésithérapie · Bruxelles</p>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                {[["Séance de kinésithérapie", "30 min · 35 €", true], ["Bilan premier rendez-vous", "45 min · 45 €", false]].map(([n, d, on]) => (
                  <div key={String(n)} className={`flex items-center justify-between rounded-xl border px-4 py-3 ${on ? "border-accent bg-surface ring-1 ring-accent" : "border-border bg-surface"}`}>
                    <div>
                      <p className="text-sm font-medium">{n}</p>
                      <p className="text-xs text-muted">{d}</p>
                    </div>
                    {on ? <Check className="size-4 text-accent" /> : null}
                  </div>
                ))}
              </div>
              <p className="mt-5 text-sm font-medium">Mardi 21 octobre</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {["08:30", "09:00", "10:30", "11:00", "14:00", "15:30", "16:00", "17:30"].map((t, i) => (
                  <span key={t} className={`rounded-lg border px-2 py-2 text-center text-sm tabular-nums ${i === 2 ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface"}`}>{t}</span>
                ))}
              </div>
              <span className="mt-5 flex h-11 items-center justify-center rounded-lg bg-accent text-sm font-medium text-accent-foreground">Réserver 10:30</span>
            </div>
            <div className="absolute -bottom-5 -left-4 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm shadow-lg sm:-left-8">
              <BellRing className="size-4 text-accent" />
              Rappel envoyé à Léa P. la veille
            </div>
          </div>
        </div>
      </section>

      {/* Chiffres */}
      <div className="border-b border-border bg-background">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4">
          {[["10 min", "pour être en ligne"], ["0 €", "pour commencer"], ["24 h/24", "vos clients réservent seuls"], ["0 %", "de commission"]].map(([n, l]) => (
            <div key={l}>
              <dt className="text-sm text-muted">{l}</dt>
              <dd className="mt-1 text-3xl font-semibold tracking-tight">{n}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Comparatif */}
      <Section>
        <SectionTitle title="Faites le calcul." sub="Pas de commission. Pas de frais cachés. Pas d'engagement. Le prix affiché est le prix payé." />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {COMPARE.map((c) => (
            <div key={c.name} className={`rounded-2xl border p-6 ${c.highlight ? "border-accent bg-surface ring-1 ring-accent" : "border-border bg-surface"}`}>
              <p className="text-sm font-medium text-muted">{c.name}</p>
              <p className={`mt-2 text-xl font-semibold ${c.highlight ? "text-accent" : ""}`}>{c.price}</p>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{c.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Remplace la pile d'outils */}
      <Section muted>
        <SectionTitle title="Aujourd'hui, votre activité tourne sur six outils. Demain, sur un seul." sub="Un cahier pour les rendez-vous, WhatsApp pour confirmer, Excel pour les clients, et toujours pas de site. Branshee remplace tout ça." />
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {STACK.map((s) => (
            <li key={s.old} className="flex gap-4 rounded-xl border border-border bg-background p-5">
              <X className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
              <div>
                <p className="text-sm text-muted line-through">{s.old}</p>
                <p className="mt-1 flex gap-2 font-medium"><Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />{s.now}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Fonctionnalités */}
      <Section id="fonctionnalites">
        <SectionTitle pill="Fonctionnalités" title="La prise de rendez-vous en ligne qui travaille pour vous." />
        <div className="space-y-6">
          {FEATURES.map((f) => (
            <div key={f.tag} className="grid grid-cols-1 gap-6 rounded-2xl border border-border bg-surface p-6 sm:p-8 lg:grid-cols-[1fr_1fr] lg:gap-10">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-accent"><f.icon className="size-4" aria-hidden="true" />{f.tag}</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-balance">{f.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">{f.desc}</p>
              </div>
              <ul className="space-y-3 self-center">
                {f.items.map((i) => (
                  <li key={i} className="flex gap-3 rounded-lg bg-background px-4 py-3 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />{i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted">Un seul rendez-vous manqué évité par mois rembourse largement le forfait Pro.</p>
      </Section>

      {/* Tout inclus */}
      <Section muted>
        <SectionTitle pill="Tout inclus" title="Tout ce qu'il vous faut. Sans mauvaise surprise." sub="Aucune option cachée : chaque forfait inclut tout ce qu'il annonce." />
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {INCLUDED.map((i) => (
            <li key={i.title} className="rounded-xl border border-border bg-background p-5">
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent"><i.icon className="size-5" aria-hidden="true" /></span>
              <p className="mt-4 font-semibold">{i.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{i.desc}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Comment ça marche */}
      <Section>
        <SectionTitle pill="Comment ça marche" title="En ligne en moins de 10 minutes." />
        <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-border bg-surface p-6">
              <span className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">{i + 1}</span>
              <p className="mt-4 text-lg font-semibold">{s.title}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.desc}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 text-center">
          <Link href="/inscription" className="inline-flex h-12 items-center gap-2 rounded-lg bg-accent px-6 text-base font-medium text-accent-foreground hover:bg-accent-hover">Lancer mon agenda maintenant<ArrowRight className="size-4" aria-hidden="true" /></Link>
          <p className="mt-3 text-sm text-muted">Gratuit, sans carte bancaire. Si ça ne vous convient pas, vous n&apos;aurez rien payé.</p>
        </div>
      </Section>

      {/* Transparence */}
      <Section muted>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-sm font-semibold text-accent">Transparence</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Si c&apos;est moins cher, où est le piège ?</h2>
            <div className="mt-6 max-w-prose space-y-4 text-[15px] leading-relaxed text-muted">
              <p>Il n&apos;y en a pas. Branshee est un produit jeune, construit avec ses premiers utilisateurs. Pas de commerciaux, pas de publicité télé, pas de commission sur votre travail : juste un logiciel qui s&apos;améliore chaque semaine. C&apos;est pour ça que le prix est bas, et qu&apos;il le restera.</p>
              <p>En échange, vous avez ce que les grandes plateformes ne donnent pas : quand vous écrivez au support, un humain vous répond, souvent dans la journée. Quand vous demandez une fonctionnalité, elle arrive souvent quelques semaines plus tard.</p>
              <p className="font-medium text-text">— L&apos;équipe Branshee</p>
            </div>
          </div>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {[
              { icon: ShieldCheck, t: "Sans engagement", d: "Résiliation en un clic, quand vous voulez. Aucun frais caché." },
              { icon: Sparkles, t: "Mises à jour chaque semaine", d: "Vos retours sont lus, et réellement mis en œuvre." },
              { icon: MessageCircle, t: "Support humain", d: "Une vraie personne vous répond, vite. Pas un robot." },
              { icon: CalendarCheck, t: "Vos données vous appartiennent", d: "Vos clients restent les vôtres : jamais démarchés, jamais redirigés ailleurs." },
            ].map((g) => (
              <li key={g.t} className="flex gap-4 rounded-xl border border-border bg-background p-5">
                <g.icon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{g.t}</p>
                  <p className="mt-1 text-sm text-muted">{g.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Tarifs */}
      <Section id="tarifs">
        <SectionTitle pill="Tarifs" title="Des prix simples. Pas de surprises." sub="Gratuit pour toujours avec Amateur. 19 €/mois quand vous grandissez, là où les logiciels classiques coûtent 30 à 70 €/mois. Jamais de commission." />
        <PricingTable />
      </Section>

      {/* Métiers */}
      <Section muted>
        <SectionTitle pill="Pour qui ?" title="La réservation en ligne, adaptée à votre métier." />
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {JOBS.map((j) => (
            <li key={j.name} className="rounded-xl border border-border bg-background p-5">
              <p className="font-semibold">{j.name}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{j.desc}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-center text-[15px]">
          Vous travaillez sur rendez-vous ? Alors Branshee est fait pour vous.{" "}
          <Link href="/logiciel-rendez-vous" className="font-medium text-accent hover:text-accent-hover">Voir par métier et par ville</Link>
        </p>
      </Section>

      {featured.length ? (
        <Section>
          <SectionTitle title="Ils prennent leurs rendez-vous avec Branshee" />
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((b) => (
              <li key={b.id}>
                <Link href={`/${b.slug}`} className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong">
                  {b.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.photoUrl} alt="" className="size-12 rounded-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-soft-foreground" aria-hidden="true">{b.name.slice(0, 2).toUpperCase()}</span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{b.name}</span>
                    <span className="block truncate text-sm text-muted">{[b.type, b.city].filter(Boolean).join(" · ")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* FAQ */}
      <Section muted={!featured.length}>
        <SectionTitle title="Questions fréquentes" sub="Tout ce qu'il faut savoir avant de vous lancer, sans jargon." />
        <div className="mx-auto max-w-3xl">
          <Faq items={FAQ} />
        </div>
      </Section>

      {/* Appel final */}
      <section className="bg-accent">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-accent-foreground sm:text-4xl">Votre prochain client réserve peut-être ce soir.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-accent-foreground/90">Gratuit pour commencer, sans carte bancaire. Sans engagement, sans commission. Le pire qui puisse arriver : vous aurez essayé gratuitement.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/inscription" className="inline-flex h-12 items-center justify-center rounded-lg bg-surface px-6 text-base font-medium text-text hover:bg-surface-muted">Créer mon agenda gratuit</Link>
            <Link href="/contact" className="inline-flex h-12 items-center justify-center rounded-lg border border-accent-foreground/40 px-6 text-base font-medium text-accent-foreground hover:bg-accent-hover">Poser une question</Link>
          </div>
        </div>
      </section>
    </>
  );
}
