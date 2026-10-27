"use client";

import { useActionState, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCircle2, FileText, Globe, Home, LayoutTemplate, Mail, MapPin, Phone, ShoppingBag, UsersRound, WandSparkles } from "lucide-react";
import { sendContact, type ContactState } from "@/server/actions/contact";

type Key = "site" | "rdv" | "tel" | "fact" | "emp" | "shop" | "mesure";
type Icon = typeof Globe;

const APPS: { key: Key; chip: string; name: string; icon: Icon; soon?: boolean; widget: ReactNode }[] = [
  { key: "site", chip: "Site web", name: "Site web", icon: Globe, widget: <><Li a="votre-entreprise.be" b={<span className="badge b-ok">En ligne</span>} /><Li a="Demandes de contact" b={<small>cette semaine</small>} /></> },
  { key: "rdv", chip: "RDV", name: "RDV", icon: CalendarDays, widget: <><Li a="10:30 · Séance" b={<small>Mardi</small>} /><Li a="14:00 · Bilan" b={<small>Mardi</small>} /></> },
  { key: "tel", chip: "Tél IA", name: "Tél IA", icon: Phone, widget: <><Li a="Demande de devis" b={<small>il y a 12 min</small>} /><Li a="Question horaires" b={<small>ce matin</small>} /></> },
  { key: "fact", chip: "Factures", name: "Factures", icon: FileText, widget: <><Li a="Facture 2026-014" b={<span className="badge b-ok">Payée</span>} /><Li a="Facture 2026-015" b={<span className="badge b-soon">En attente</span>} /></> },
  { key: "emp", chip: "Employés", name: "Employés", icon: UsersRound, soon: true, widget: <><Li a="Julie" b={<small>8h – 16h</small>} /><Li a="Marc" b={<small>congé</small>} /></> },
  { key: "shop", chip: "Boutique", name: "Boutique", icon: ShoppingBag, soon: true, widget: <><Li a="Commande #1042" b={<span className="badge b-ok">Payée</span>} /><Li a="Stock faible" b={<small>2 produits</small>} /></> },
  { key: "mesure", chip: "Sur mesure", name: "Votre projet", icon: WandSparkles, widget: <><Li a="Construit pour vous" b={<span className="badge b-acc">Sur mesure</span>} /><Li a="Maquette" b={<small>avant de payer</small>} /></> },
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
  const [picked, setPicked] = useState<Set<Key>>(new Set(["site", "rdv"]));
  const [wish, setWish] = useState("");
  const [details, setDetails] = useState("");
  const [phone, setPhone] = useState("");
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContact, undefined);
  const err = state?.fieldErrors ?? {};

  const list = APPS.filter((a) => picked.has(a.key));
  const names = list.map((a) => a.chip);
  const toggle = (k: Key) => setPicked((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const message = [names.length ? `Apps choisies : ${names.join(", ")}` : null, phone.trim() ? `Téléphone : ${phone.trim()}` : null, "", details.trim() || "Je souhaite recevoir un devis."].filter((l) => l !== null).join("\n");

  function sendWish(e: React.FormEvent) {
    e.preventDefault();
    setPicked((p) => new Set(p).add("mesure"));
    if (wish.trim()) setDetails(wish.trim());
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => document.getElementById("c-name")?.focus({ preventScroll: true }), 500);
  }

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div className="hero-txt">
            <span className="pill"><b>Wavre</b>Un seul interlocuteur pour tout</span>
            <h1>Composez le logiciel de <span className="a">votre entreprise.</span></h1>
            <p className="lead">Site web, rendez-vous, factures, boutique, employés, téléphone IA. Un seul abonnement pour toutes les apps, et tout le reste sur mesure.</p>
          </div>

          <div className="builder">
            <ul className="picker" aria-label="Choisissez vos apps">
              {APPS.map((a) => (
                <li key={a.key}>
                  <button className="chip" type="button" aria-pressed={picked.has(a.key)} onClick={() => toggle(a.key)}>
                    <span className="box"><Check className="ico" aria-hidden="true" /></span>
                    {a.chip}
                    {a.soon ? <small>Bientôt</small> : null}
                  </button>
                </li>
              ))}
            </ul>

            <div className="app-win" aria-label="Aperçu de votre espace Skydev">
              <div className="win-bar"><span className="dots" aria-hidden="true"><i /><i /><i /></span><span className="url">client.skydev.be</span><span style={{ width: 42 }} aria-hidden="true" /></div>
              <div className="win-body">
                <aside className="side" aria-hidden="true">
                  <div className="who"><span className="avatar">VE</span><div><b>Votre entreprise</b><span>Espace Skydev</span></div></div>
                  <div className="side-label">Vos apps</div>
                  <div className="nav-item cur"><Home className="ico" />Accueil</div>
                  {list.length ? list.map((a) => <div key={a.key} className="nav-item"><a.icon className="ico" />{a.name}</div>) : <div className="empty-side">Aucune app</div>}
                </aside>
                <div className="main">
                  <div className="main-h"><b>Bonjour !</b><span className="badge b-acc">{list.length} {list.length > 1 ? "apps" : "app"}</span></div>
                  <div className="widgets">
                    {list.length ? (
                      list.map((a) => (
                        <div key={a.key} className="w">
                          <div className="w-h"><span className="ic"><a.icon className="ico" aria-hidden="true" /></span>{a.name}{a.soon ? <span className="badge b-soon">Bientôt</span> : null}</div>
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
              <Link className="btn btn-primary" href="/inscription">Créer mon compte <ArrowRight className="ico ico-sm" aria-hidden="true" /></Link>
              <a className="btn btn-ghost" href="#contact">Recevoir un devis</a>
            </div>
          </div>
        </div>
      </section>

      <section className="block" id="apps">
        <div className="wrap">
          <div className="head">
            <span className="eyebrow">Les apps</span>
            <h2>Chaque app fait une chose, et la fait bien.</h2>
            <p>Elles partagent vos clients et votre agenda. Vous en ajoutez quand vous voulez, sans tout recommencer.</p>
          </div>
          <div className="bento">
            <article className="cell s3">
              <div className="cell-h"><span className="app-ic"><Globe className="ico" aria-hidden="true" /></span><span className="badge b-ok">Disponible</span></div>
              <h3>Site web</h3>
              <p>Rapide sur mobile, pensé pour Google, relié à vos rendez-vous. Le site et le domaine sont à vous.</p>
              <div className="demo" aria-hidden="true"><div className="site-prev"><div className="sb" /><div className="sc"><div className="sk" style={{ width: "55%", height: 14, background: "var(--text)" }} /><div className="sk" style={{ width: "80%" }} /><div className="sk" style={{ width: "65%" }} /><div className="sk" style={{ width: 110, height: 28, background: "var(--accent)", borderRadius: 8, marginTop: 4 }} /></div></div></div>
            </article>
            <article className="cell s3">
              <div className="cell-h"><span className="app-ic"><CalendarDays className="ico" aria-hidden="true" /></span><span className="badge b-ok">Disponible</span></div>
              <h3>RDV</h3>
              <p>Vos clients réservent seuls, 24 h/24. Rappels automatiques et carte en garantie contre les absences.</p>
              <div className="demo" aria-hidden="true"><div className="slots">{["09:00", "09:30", "10:30", "11:00", "14:00", "14:30", "16:00", "17:30"].map((t) => <span key={t} className={t === "10:30" ? "slot on" : "slot"}>{t}</span>)}</div></div>
            </article>
            <article className="cell s2">
              <div className="cell-h"><span className="app-ic"><Phone className="ico" aria-hidden="true" /></span><span className="badge b-acc">Option</span></div>
              <h3>Tél IA</h3>
              <p>Une IA décroche quand vous êtes occupé et vous envoie le résumé.</p>
              <div className="demo" aria-hidden="true"><div className="call"><span className="live" /><span style={{ flex: 1, fontWeight: 500 }}>Appel en cours</span><span className="wave">{[0, 0.15, 0.3, 0.45, 0.6, 0.75].map((d) => <i key={d} style={{ animationDelay: `${d}s` }} />)}</span></div></div>
            </article>
            <article className="cell s2">
              <div className="cell-h"><span className="app-ic"><FileText className="ico" aria-hidden="true" /></span><span className="badge b-soon">Bientôt</span></div>
              <h3>Factures</h3>
              <p>Devis et factures conformes en quelques clics, avec la TVA.</p>
              <div className="demo" aria-hidden="true"><div className="inv"><span>Facture 2026-014</span><span className="badge b-ok">Payée</span></div><div className="inv"><span>Devis 2026-008</span><span className="badge b-acc">Envoyé</span></div></div>
            </article>
            <article className="cell s2">
              <div className="cell-h"><span className="app-ic"><UsersRound className="ico" aria-hidden="true" /></span><span className="badge b-soon">Bientôt</span></div>
              <h3>Employés</h3>
              <p>Planning, horaires et congés de l&apos;équipe, liés à l&apos;agenda.</p>
              <div className="demo" aria-hidden="true"><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span className="people"><i>JD</i><i>MR</i><i>+3</i></span><small className="muted">Semaine 45</small></div><div className="bar"><span style={{ width: "72%" }} /></div></div>
            </article>
            <article className="cell s6">
              <div className="cell-h"><span className="app-ic"><ShoppingBag className="ico" aria-hidden="true" /></span><span className="badge b-soon">Bientôt</span></div>
              <h3>Boutique</h3>
              <p>Vendez vos produits depuis votre site : catalogue, paiement Bancontact et carte, suivi des commandes. Pour une grosse boutique dès maintenant, passez par le sur mesure.</p>
            </article>
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
              <ul className="pl"><li>RDV, Clients, Site web, Factures, Employés</li><li>Les nouvelles apps incluses</li><li>30 jours d&apos;essai gratuit</li></ul>
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
