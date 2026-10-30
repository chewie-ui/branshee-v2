"use client";

import { useActionState, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCircle2, Eye, FileText, Gift, Globe, Home, LayoutTemplate, Mail, MapPin, Phone, ShieldCheck, Smartphone, Store, UsersRound } from "lucide-react";
import { APPS, CATEGORY_LABEL, appById, type AppCategory, type AppId } from "@/lib/apps";
import { AppIcon } from "@/components/apps/app-icon";
import { sendContact, type ContactState } from "@/server/actions/contact";

type Icon = typeof Globe;

// Aperçu interactif : les apps les plus demandées (toutes les autres sont listées plus bas).
const PICK: { key: AppId; chip: string; option?: boolean; widget: ReactNode }[] = [
  { key: "site", chip: "Site web", widget: <><Li a="votre-entreprise.be" b={<span className="badge b-ok">En ligne</span>} /><Li a="Demandes de contact" b={<small>cette semaine</small>} /></> },
  { key: "rdv", chip: "RDV", widget: <><Li a="10:30 · Séance" b={<small>Mardi</small>} /><Li a="14:00 · Bilan" b={<small>Mardi</small>} /></> },
  { key: "factures", chip: "Factures", widget: <><Li a="Facture 2026-014" b={<span className="badge b-ok">Payée</span>} /><Li a="Devis 2026-008" b={<span className="badge b-acc">Signé</span>} /></> },
  { key: "caisse", chip: "Caisse", widget: <><Li a="Ticket n° 231 · 18,50 €" b={<small>Bancontact</small>} /><Li a="Clôture du jour" b={<span className="badge b-ok">Faite</span>} /></> },
  { key: "boutique", chip: "Boutique", widget: <><Li a="Commande n° 1042" b={<span className="badge b-ok">Payée</span>} /><Li a="À préparer" b={<small>3 commandes</small>} /></> },
  { key: "horaires", chip: "Planning", widget: <><Li a="Julie" b={<small>8h – 16h</small>} /><Li a="Marc" b={<small>congé</small>} /></> },
  { key: "stock", chip: "Stock", widget: <><Li a="Stock faible" b={<span className="badge b-soon">2 produits</span>} /><Li a="Réception fournisseur" b={<small>hier</small>} /></> },
  { key: "fidelite", chip: "Fidélité", widget: <><Li a="Léa · 8 / 10 tampons" b={<small>QR scanné</small>} /><Li a="Récompenses à offrir" b={<span className="badge b-acc">1</span>} /></> },
  { key: "taches", chip: "Tâches", widget: <><Li a="Rappeler le fournisseur" b={<small>aujourd&apos;hui</small>} /><Li a="Commander les cartes" b={<small>@Julie</small>} /></> },
  { key: "commandes", chip: "Commande à table", widget: <><Li a="Table 4 · 2 plats" b={<span className="badge b-soon">En cuisine</span>} /><Li a="Table 7" b={<span className="badge b-ok">Servie</span>} /></> },
  { key: "tel-ia", chip: "Tél IA", option: true, widget: <><Li a="Demande de devis" b={<small>il y a 12 min</small>} /><Li a="Question horaires" b={<small>ce matin</small>} /></> },
  { key: "sur-mesure", chip: "Sur mesure", widget: <><Li a="Construit pour vous" b={<span className="badge b-acc">Sur mesure</span>} /><Li a="Maquette" b={<small>avant de payer</small>} /></> },
];

const CATALOG = APPS.filter((a) => a.id !== "reglages");
const ORDER: AppCategory[] = ["clients", "finance", "equipe", "operations", "marketing", "services"];

// Ce qui rend Skydev différent d'une pile de logiciels séparés.
const LINKED: { icon: Icon; title: string; text: string }[] = [
  { icon: UsersRound, title: "Un seul fichier clients", text: "Le client qui réserve, achète ou reçoit une facture est le même partout : tout son historique sur une fiche." },
  { icon: ShieldCheck, title: "Chacun voit ses apps", text: "Votre comptable ne voit que les factures, votre équipe que son planning. Vous choisissez, grade par grade." },
  { icon: FileText, title: "Factures conformes", text: "Mentions belges obligatoires vérifiées, PDF, QR de paiement, rappels automatiques et fichier Peppol." },
  { icon: Smartphone, title: "Sur ordinateur et téléphone", text: "Tout fonctionne sur mobile, pour vous comme pour vos clients : réservation, carte de fidélité, commande." },
];

// Être trouvé : l'annuaire public et la page de chaque entreprise.
const FINDABLE: { icon: Icon; title: string; text: string }[] = [
  { icon: MapPin, title: "Trouvé par métier et par ville", text: "Votre page apparaît dans « coiffeur à Wavre », « kiné à Namur »… les recherches que vos clients font vraiment." },
  { icon: Globe, title: "Votre page, à votre image", text: "Photos, présentation, prestations, prix, avis. Vous la personnalisez, ou vous passez à un vrai site web." },
  { icon: CalendarDays, title: "Réservé 24 h/24", text: "Le client réserve le créneau libre sans vous appeler. Vous recevez la réservation, il reçoit le rappel." },
  { icon: Check, title: "Une page complète passe devant", text: "Plus votre page est remplie, plus elle ressort haut dans l'annuaire. L'app vous dit ce qu'il manque." },
];

function Li({ a, b }: { a: string; b: ReactNode }) {
  return <div className="li"><span>{a}</span>{b}</div>;
}

const WORK = [
  { url: "https://themaddyfriterie.be", name: "The Maddy Friterie", what: "Friterie · Wavre" },
  { url: "https://car-world.be", name: "Car World", what: "Garage · Evere" },
  { url: "https://from-arusha.com", name: "From Arusha", what: "Boutique en ligne" },
  { url: "https://coachennutrition.be", name: "Coach en nutrition", what: "Nutrition et yoga" },
  { url: "https://filroses.eu", name: "Fil Roses", what: "Catalogue de roses" },
  { url: "https://branshee.com", name: "Branshee", what: "Le moteur de l'app RDV" },
];

const IDEAS = ["Espace client", "Suivi de chantier", "App mobile", "Automatisation"];

export function SkydevLanding() {
  const [picked, setPicked] = useState<Set<AppId>>(new Set(["site", "rdv", "factures"]));
  const [wish, setWish] = useState("");
  const [details, setDetails] = useState("");
  const [phone, setPhone] = useState("");
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContact, undefined);
  const err = state?.fieldErrors ?? {};

  const list = PICK.filter((a) => picked.has(a.key)).map((a) => ({ ...a, app: appById(a.key) }));
  const names = list.map((a) => a.chip);
  const toggle = (k: AppId) => setPicked((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const message = [names.length ? `Apps choisies : ${names.join(", ")}` : null, phone.trim() ? `Téléphone : ${phone.trim()}` : null, "", details.trim() || "Je souhaite recevoir un devis."].filter((l) => l !== null).join("\n");

  function sendWish(e: React.FormEvent) {
    e.preventDefault();
    setPicked((p) => new Set(p).add("sur-mesure"));
    if (wish.trim()) setDetails(wish.trim());
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => document.getElementById("c-name")?.focus({ preventScroll: true }), 500);
  }

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div className="hero-txt">
            <span className="pill"><b>{CATALOG.length} apps</b>Un seul abonnement, tout est relié</span>
            <h1>Tout le logiciel de <span className="a">votre entreprise.</span></h1>
            <p className="lead lead-tight">Rendez-vous, factures, site web, caisse, boutique, stock, planning, fidélité, tâches… {CATALOG.length} apps qui partagent vos clients et votre agenda. Et ce qui manque, on le construit sur mesure.</p>
          </div>

          <div className="hero-cta">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- route qui ouvre une session : vraie navigation */}
            <a className="btn btn-primary btn-lg" href="/demo"><Eye className="ico ico-sm" aria-hidden="true" />Voir la démo, sans inscription</a>
            <Link className="btn btn-ghost btn-lg" href="/inscription">Créer mon compte gratuit</Link>
            <p className="hero-note">La démo s&apos;ouvre tout de suite : un cabinet fictif rien que pour vous, avec ses rendez-vous, factures, clients et stock. Essayez tout, rien n&apos;est conservé.</p>
            <p className="hero-note">Vous cherchez un professionnel ? <Link href="/annuaire" className="hero-find">Trouvez-le dans l&apos;annuaire</Link>.</p>
          </div>

          <div className="builder">
            <ul className="picker" aria-label="Choisissez vos apps">
              {PICK.map((a) => (
                <li key={a.key}>
                  <button className="chip" type="button" aria-pressed={picked.has(a.key)} onClick={() => toggle(a.key)}>
                    <span className="box"><Check className="ico" aria-hidden="true" /></span>
                    {a.chip}
                    {a.option ? <small>Option</small> : null}
                  </button>
                </li>
              ))}
              <li><a className="chip chip-more" href="#apps">+ {CATALOG.length - PICK.length} autres apps</a></li>
            </ul>

            <div className="app-win" aria-label="Aperçu de votre espace Skydev">
              <div className="win-bar"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="url">skydev.be/app</span><span style={{ width: 42 }} aria-hidden="true" /></div>
              <div className="win-body">
                <aside className="side" aria-hidden="true">
                  <div className="who"><span className="avatar">VE</span><div><b>Votre entreprise</b><span>Espace Skydev</span></div></div>
                  <div className="side-label">Vos apps</div>
                  <div className="nav-item cur"><Home className="ico" />Accueil</div>
                  {list.length ? list.map((a) => <div key={a.key} className="nav-item"><AppIcon icon={a.app.icon} className="ico" />{a.app.name}</div>) : <div className="empty-side">Aucune app</div>}
                </aside>
                <div className="main">
                  <div className="main-h"><b>Bonjour !</b><span className="badge b-acc">{list.length} {list.length > 1 ? "apps" : "app"}</span></div>
                  <div className="widgets">
                    {list.length ? (
                      list.map((a) => (
                        <div key={a.key} className="w">
                          <div className="w-h"><span className="ic"><AppIcon icon={a.app.icon} className="ico" /></span>{a.app.name}{a.option ? <span className="badge b-acc">Option</span> : null}</div>
                          {a.widget}
                        </div>
                      ))
                    ) : (
                      <div className="empty"><LayoutTemplate className="ico" aria-hidden="true" />Choisissez une app au-dessus pour la voir apparaître ici.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="builder-cta">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- route qui ouvre une session : vraie navigation */}
              <a className="btn btn-primary" href="/demo">Essayer ces apps dans la démo <ArrowRight className="ico ico-sm" aria-hidden="true" /></a>
              <Link className="btn btn-ghost" href="/inscription">Créer mon compte</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="block" id="apps">
        <div className="wrap">
          <div className="head">
            <span className="eyebrow">Les apps</span>
            <h2>{CATALOG.length} apps. Un seul abonnement.</h2>
            <p>Activez seulement celles dont vous avez besoin, ajoutez-en quand vous voulez. Toutes sont incluses, sauf les options.</p>
          </div>
          <div className="bento">
            <article className="cell s3">
              <div className="cell-h"><span className="app-ic"><CalendarDays className="ico" aria-hidden="true" /></span><span className="badge b-ok">Inclus</span></div>
              <h3>Rendez-vous en ligne</h3>
              <p>Vos clients réservent seuls, 24 h/24. Rappels SMS et email, acompte ou carte en garantie contre les absences, avis Google demandés après la visite.</p>
              <div className="demo" aria-hidden="true"><div className="slots">{["09:00", "09:30", "10:30", "11:00", "14:00", "14:30", "16:00", "17:30"].map((t) => <span key={t} className={t === "10:30" ? "slot on" : "slot"}>{t}</span>)}</div></div>
            </article>
            <article className="cell s3">
              <div className="cell-h"><span className="app-ic"><FileText className="ico" aria-hidden="true" /></span><span className="badge b-ok">Inclus</span></div>
              <h3>Devis, factures et compta</h3>
              <p>Devis signés en ligne, factures conformes en PDF avec QR de paiement, rappels automatiques, dépenses, aide à la TVA et export pour le comptable.</p>
              <div className="demo" aria-hidden="true"><div className="inv"><span>Facture 2026-014</span><span className="badge b-ok">Payée</span></div><div className="inv"><span>Devis 2026-008</span><span className="badge b-acc">Signé</span></div></div>
            </article>
            <article className="cell s2">
              <div className="cell-h"><span className="app-ic"><Store className="ico" aria-hidden="true" /></span><span className="badge b-ok">Inclus</span></div>
              <h3>Vendre</h3>
              <p>Caisse au comptoir, boutique en ligne, commande à table par QR code et stock tenu à jour tout seul.</p>
            </article>
            <article className="cell s2">
              <div className="cell-h"><span className="app-ic"><UsersRound className="ico" aria-hidden="true" /></span><span className="badge b-ok">Inclus</span></div>
              <h3>Votre équipe</h3>
              <p>Planning, congés, pré-paie, tâches et messagerie. Chaque employé a ses accès.</p>
              <div className="demo" aria-hidden="true"><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span className="people"><i>JD</i><i>MR</i><i>+3</i></span><small className="muted">Semaine 45</small></div><div className="bar"><span style={{ width: "72%" }} /></div></div>
            </article>
            <article className="cell s2">
              <div className="cell-h"><span className="app-ic"><Gift className="ico" aria-hidden="true" /></span><span className="badge b-ok">Inclus</span></div>
              <h3>Faire revenir vos clients</h3>
              <p>Carte de fidélité à scanner, cartes cadeaux, avis Google et campagnes email.</p>
            </article>
            <article className="cell s3">
              <div className="cell-h"><span className="app-ic"><Globe className="ico" aria-hidden="true" /></span><span className="badge b-ok">Inclus</span></div>
              <h3>Site web</h3>
              <p>Rapide sur mobile, pensé pour Google, relié à vos rendez-vous et à votre boutique. Le site et le domaine sont à vous.</p>
              <div className="demo" aria-hidden="true"><div className="site-prev"><div className="sb" /><div className="sc"><div className="sk" style={{ width: "55%", height: 14, background: "var(--text)" }} /><div className="sk" style={{ width: "80%" }} /><div className="sk" style={{ width: "65%" }} /><div className="sk" style={{ width: 110, height: 28, background: "var(--accent)", borderRadius: 8, marginTop: 4 }} /></div></div></div>
            </article>
            <article className="cell s3">
              <div className="cell-h"><span className="app-ic"><Phone className="ico" aria-hidden="true" /></span><span className="badge b-acc">Option</span></div>
              <h3>Tél IA</h3>
              <p>Une IA décroche quand vous êtes occupé, répond aux questions courantes et vous envoie le résumé de l&apos;appel.</p>
              <div className="demo" aria-hidden="true"><div className="call"><span className="live" /><span style={{ flex: 1, fontWeight: 500 }}>Appel en cours</span><span className="wave">{[0, 0.15, 0.3, 0.45, 0.6, 0.75].map((d) => <i key={d} style={{ animationDelay: `${d}s` }} />)}</span></div></div>
            </article>
          </div>

          <div className="catalog" aria-label="Toutes les apps">
            {ORDER.map((cat) => {
              const apps = CATALOG.filter((a) => a.category === cat);
              if (!apps.length) return null;
              return (
                <div key={cat} className="cat">
                  <h3>{CATEGORY_LABEL[cat]}</h3>
                  <ul>
                    {apps.map((a) => (
                      <li key={a.id}>
                        <span className="cat-ic"><AppIcon icon={a.icon} className="ico" /></span>
                        <span className="cat-t"><b>{a.name}{a.billing === "addon" ? <em className="badge b-acc">Option</em> : a.billing === "quote" ? <em className="badge b-acc">Sur devis</em> : null}</b><small>{a.tagline}</small></span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="block" id="relie">
        <div className="wrap">
          <div className="head"><span className="eyebrow">Tout est relié</span><h2>Fini les 6 logiciels qui ne se parlent pas.</h2><p>Avec des outils séparés, vous recopiez les mêmes infos partout. Ici, une réservation, une vente ou une facture met tout le reste à jour.</p></div>
          <div className="linked">
            {LINKED.map((l) => (
              <div key={l.title} className="lk">
                <span className="app-ic"><l.icon className="ico" aria-hidden="true" /></span>
                <h3>{l.title}</h3>
                <p>{l.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="block" id="clients">
        <div className="wrap">
          <div className="head"><span className="eyebrow">Plus de clients</span><h2>Vos futurs clients vous cherchent déjà.</h2><p>Chaque entreprise sur Skydev a sa page dans l&apos;annuaire. Les particuliers y cherchent « coiffeur à Wavre » ou « kiné à Namur », trouvent votre page et réservent, même quand vous êtes occupé.</p></div>
          <div className="linked">
            {FINDABLE.map((l) => (
              <div key={l.title} className="lk">
                <span className="app-ic"><l.icon className="ico" aria-hidden="true" /></span>
                <h3>{l.title}</h3>
                <p>{l.text}</p>
              </div>
            ))}
          </div>
          <div className="find-cta">
            <Link className="btn btn-primary" href="/inscription">Créer ma page</Link>
            <Link className="btn btn-ghost" href="/annuaire">Voir l&apos;annuaire</Link>
          </div>
        </div>
      </section>

      <section className="block" id="sur-mesure">
        <div className="wrap">
          <div className="custom">
            <div>
              <span className="eyebrow">Sur mesure</span>
              <h2>Tout, sur mesure. Dites-nous exactement ce que vous voulez.</h2>
              <p>Un site unique, une grosse boutique, une app mobile, un logiciel pour votre métier, un CRM, une automatisation, un outil avec de l&apos;IA… Si vous pouvez le décrire, on peut le construire. Prix fixe annoncé avant de commencer.</p>
              <ul>
                <li><Check className="ico" aria-hidden="true" />On en parle 15 minutes</li>
                <li><Check className="ico" aria-hidden="true" />Vous voyez une maquette avant de payer</li>
                <li><Check className="ico" aria-hidden="true" />Un prix fixe, annoncé à l&apos;avance</li>
              </ul>
            </div>
            <form className="prompt" onSubmit={sendWish}>
              <label htmlFor="wish">Décrivez votre projet</label>
              <textarea id="wish" value={wish} onChange={(e) => setWish(e.target.value)} placeholder="Ex. : je veux que mes clients suivent l'avancement de leur chantier, avec des photos à chaque étape." />
              <div className="prompt-f">
                <div className="ideas" aria-label="Idées">
                  {IDEAS.map((i) => <button key={i} type="button" className="idea" onClick={() => setWish((w) => (w.trim() ? w.trim() + " " : "") + i + " : ")}>{i}</button>)}
                </div>
                <button className="btn btn-white btn-sm" type="submit">Continuer <ArrowRight className="ico ico-sm" aria-hidden="true" /></button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="block" id="realisations">
        <div className="wrap">
          <div className="head"><span className="eyebrow">Réalisations</span><h2>Déjà en ligne.</h2></div>
          <div className="work">
            {WORK.map((w) => (
              <a key={w.url} className="site" href={w.url} target="_blank" rel="noopener noreferrer">
                <span className="fav" aria-hidden="true">{w.name.charAt(0)}</span>
                <span><b>{w.name}</b><small>{w.what}</small></span>
                <ArrowUpRight className="ico" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="block" id="tarifs">
        <div className="wrap">
          <div className="head"><span className="eyebrow">Tarifs</span><h2>Un abonnement, toutes les apps.</h2><p>Pas un abonnement par app : vous payez par personne de l&apos;équipe, et vous utilisez tout ce qui est inclus. Plus l&apos;équipe grandit, moins chaque personne coûte.</p></div>
          <div className="prices">
            <div className="price hl"><span className="lbl">Toutes les apps</span><b>29 €</b><small>par mois, TVAC · pour vous, le 1er utilisateur</small>
              <ul className="pl"><li>Les {CATALOG.length - 2} apps incluses (hors options)</li><li>Les nouvelles apps incluses</li><li>30 jours d&apos;essai gratuit, sans carte</li></ul>
              <Link className="btn btn-primary" href="/inscription">Commencer</Link></div>
            <div className="price"><span className="lbl">Votre équipe</span><b>dès 15 €</b><small>par personne ajoutée, TVAC · le prix baisse à chaque ajout</small>
              <ul className="pl"><li>2e personne : 25 €, 3e : 22 €, 4e : 20 €</li><li>Puis 18 €, 16 €, et 15 € pour toutes les suivantes</li><li>Exemple : équipe de 3, 76 € par mois</li></ul>
              <Link className="btn btn-ghost" href="/inscription">Commencer</Link></div>
            <div className="price"><span className="lbl">Sur mesure</span><b>Sur devis</b><small>prix fixe annoncé avant de commencer</small>
              <ul className="pl"><li>Sites sur mesure, dès 600 €</li><li>Apps web et mobiles, logiciels, CRM</li><li>Automatisations et outils IA</li></ul>
              <a className="btn btn-ghost" href="#contact">Demander un devis</a></div>
          </div>
          <div className="addons">
            <span className="lbl">Options</span>
            <span className="addon">Tél IA <small>forfait de minutes</small></span>
            <span className="addon">Rappels SMS <small>packs de crédits</small></span>
            <span className="addon">Votre nom de domaine</span>
          </div>
        </div>
      </section>

      <section className="block" id="contact">
        <div className="wrap contact">
          <div>
            <span className="eyebrow">Contact</span>
            <h2>Parlons de votre projet.</h2>
            <p className="muted" style={{ fontSize: 18, margin: "14px 0 0" }}>Je vous réponds sous 24 h avec une première estimation.</p>
            <div className="coord">
              <a href="tel:+32477443988"><Phone className="ico" aria-hidden="true" />0477 44 39 88</a>
              <a href="mailto:info@skydev.be"><Mail className="ico" aria-hidden="true" />info@skydev.be</a>
              <div><MapPin className="ico" aria-hidden="true" />Wavre, Brabant wallon</div>
            </div>
          </div>
          {state?.ok ? (
            <div className="form"><div className="done" role="status"><CheckCircle2 className="ico" aria-hidden="true" /><b style={{ fontSize: 18 }}>Demande envoyée</b><p className="muted" style={{ margin: 0 }}>Merci ! Je vous réponds par email sous 24 h.</p></div></div>
          ) : (
            <form className="form" action={action} noValidate>
              {state?.error ? <p className="alert" role="alert">{state.error}</p> : null}
              <div className="sel">{names.length ? <>Apps choisies : <b>{names.join(", ")}</b></> : "Aucune app choisie : décrivez votre besoin ci-dessous."}</div>
              <input type="hidden" name="subject" value={`Demande Skydev${names.length ? ` — ${names.join(", ")}` : ""}`} />
              <input type="hidden" name="message" value={message} />
              <div className="hp" aria-hidden="true"><label>Site web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
              <div className="row2">
                <label className="f">Nom<input id="c-name" name="name" autoComplete="name" defaultValue={state?.values?.name} aria-invalid={!!err.name || undefined} />{err.name ? <span className="err">{err.name}</span> : null}</label>
                <label className="f">Email<input name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} aria-invalid={!!err.email || undefined} />{err.email ? <span className="err">{err.email}</span> : null}</label>
              </div>
              <label className="f">Téléphone (facultatif)<input name="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
              <label className="f">Votre projet (facultatif)<textarea className="t" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Ex. : je suis kiné à Wavre, je veux un site et que mes patients réservent en ligne." /></label>
              {err.message ? <span className="err">{err.message}</span> : null}
              <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending || undefined}>{pending ? "Envoi…" : "Envoyer ma demande"}</button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
