import Link from "next/link";
import { ArrowRight, ArrowUpRight, Bot, Check, Code2, Globe, Mail, MapPin, Phone, RefreshCw, Search, ShoppingBag, Smartphone, UsersRound } from "lucide-react";
import { SITE_FROM_EUR } from "@/lib/custom-services";
import { customServicesL } from "@/lib/custom-services-i18n";
import { storeCount } from "@/lib/app-store";
import { storeHrefL } from "@/lib/app-store-i18n";
import { ContactFormEn } from "@/components/skydev/contact-form-en";

type Icon = typeof Globe;
const ICONS: Record<string, Icon> = {
  "website-design": Globe, "website-redesign": RefreshCw, "online-store": ShoppingBag, "web-app-saas": Code2,
  "mobile-app": Smartphone, "crm-business-software": UsersRound, "automation-ai": Bot, "local-seo": Search,
};

const WORK = [
  { url: "https://morgane-forzee.be", name: "Morgane Forzée", what: "Physiotherapist · Belgium" },
  { url: "https://themaddyfriterie.be", name: "The Maddy Friterie", what: "Restaurant · Belgium" },
  { url: "https://car-world.be", name: "Car World", what: "Car dealer · Brussels" },
  { url: "https://from-arusha.com", name: "From Arusha", what: "Online store" },
  { url: "https://coachennutrition.be", name: "Coach en nutrition", what: "Nutrition and yoga" },
  { url: "https://filroses.eu", name: "Fil Roses", what: "Rose catalogue" },
  { url: "https://branshee.com", name: "Branshee", what: "Booking SaaS" },
];

const STEPS = [
  { t: "A 15-minute call", d: "By phone or video, in English or French. You explain what you need, I ask the right questions." },
  { t: "A mock-up before you pay", d: "You see what it will look like and how it will work before committing to anything." },
  { t: "A fixed price, agreed upfront", d: "No hourly billing and no surprises. Then I build it, and you follow the progress." },
];

/** Accueil du site anglais : le sur mesure d'abord (clients partout dans le monde), puis la plateforme. */
export function SkydevLandingEn({ signedIn = false }: { signedIn?: boolean }) {
  const services = customServicesL("en");
  const apps = storeCount();
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div className="hero-txt">
            <span className="pill"><b>Custom work</b>Websites · apps · SaaS · automation</span>
            <h1>Websites and software, <span className="a">built for your business.</span></h1>
            <p className="lead lead-tight">From a fast showcase website to a full web app or SaaS: designed, built and maintained for you. Based in Belgium, working with clients everywhere, in English or French.</p>
          </div>
          <div className="hero-cta">
            <Link className="btn btn-primary btn-lg" href="/en#contact">Get a free estimate<ArrowRight className="ico ico-sm" aria-hidden="true" /></Link>
            <Link className="btn btn-ghost btn-lg" href="/en/custom">See all services</Link>
            <p className="hero-note">Reply within 24 hours · mock-up before you pay · fixed price</p>
          </div>
        </div>
      </section>

      <section className="block" id="services">
        <div className="wrap">
          <div className="head"><span className="eyebrow">Services</span><h2>If you can describe it, we can build it.</h2><p>Websites from €{SITE_FROM_EUR}. Everything else on a fixed quote, agreed before we start.</p></div>
          <div className="linked">
            {services.map((s) => {
              const I = ICONS[s.slug] ?? Globe;
              return (
                <Link key={s.slug} href={`/en/custom/${s.slug}`} className="lk" style={{ textDecoration: "none" }}>
                  <span className="app-ic"><I className="ico" aria-hidden="true" /></span>
                  <h3>{s.nom}</h3>
                  <p>{s.intro}</p>
                  <p style={{ marginTop: 8, fontWeight: 600, color: "var(--accent)" }}>{s.prix} →</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="block" id="process">
        <div className="wrap">
          <div className="custom">
            <div>
              <span className="eyebrow">How it works</span>
              <h2>Simple, clear and remote-friendly.</h2>
              <p>Everything happens by video call, email and shared previews, wherever you are.</p>
              <ul>
                {STEPS.map((s) => <li key={s.t}><Check className="ico" aria-hidden="true" /><span><b>{s.t}</b> — {s.d}</span></li>)}
              </ul>
            </div>
            <div className="prompt" style={{ display: "flex", flexDirection: "column", gap: 12, justifyContent: "center" }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Have a project in mind?</p>
              <p style={{ margin: 0 }}>Tell me about it: I&apos;ll come back within 24 hours with a first estimate.</p>
              <Link className="btn btn-white btn-sm" href="/en#contact" style={{ alignSelf: "flex-start" }}>Describe my project <ArrowRight className="ico ico-sm" aria-hidden="true" /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="block" id="realisations">
        <div className="wrap">
          <div className="head"><span className="eyebrow">Work</span><h2>Already live.</h2></div>
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

      <section className="block" id="apps">
        <div className="wrap">
          <div className="head"><span className="eyebrow">The Skydev platform</span><h2>Or start with {apps} ready-made apps.</h2><p>Online booking, clients, point of sale, online store, stock, scheduling, loyalty… connected apps sharing the same clients and calendar, in one subscription. A few apps follow Belgian rules (invoices, payroll, accounting) and are marked “Belgium only”.</p></div>
          <div className="find-cta">
            <Link className="btn btn-primary" href="/en/apps">Browse the apps</Link>
            <Link className="btn btn-ghost" href={storeHrefL("rdv", "en")}>Online booking</Link>
          </div>
        </div>
      </section>

      <section className="block" id="tarifs">
        <div className="wrap">
          <div className="head"><span className="eyebrow">Pricing</span><h2>Clear prices.</h2><p>Custom work at a fixed price, or the Skydev platform per team member: the bigger the team, the less each person costs.</p></div>
          <div className="prices">
            <div className="price hl"><span className="lbl">Custom work</span><b>Fixed quote</b><small>agreed before we start</small>
              <ul className="pl"><li>Websites from €{SITE_FROM_EUR}</li><li>Web and mobile apps, SaaS, CRM</li><li>Automation and AI tools</li></ul>
              <Link className="btn btn-primary" href="/en#contact">Get an estimate</Link></div>
            <div className="price"><span className="lbl">All apps <em className="promo">First month free</em></span>
              <b><s aria-hidden="true">€29</s> €0<span className="sr-only"> the first month, then €29 a month</span></b>
              <small>the first month, then €29 a month incl. VAT · for you, the first user</small>
              <ul className="pl"><li>Every included app (except add-ons)</li><li>New apps included</li><li>No credit card, no commitment</li></ul>
              <Link className="btn btn-ghost" href={signedIn ? "/app/reglages/abonnement" : "/en/signup"}>{signedIn ? "My subscription" : "Try it for free"}</Link></div>
            <div className="price"><span className="lbl">Your team</span><b>from €15</b><small>per added person, incl. VAT · the price drops with each one</small>
              <ul className="pl"><li>2nd person: €25, 3rd: €22, 4th: €20</li><li>Then €18, €16, and €15 for everyone after</li><li>Example: team of 3, €76 a month</li></ul>
              <Link className="btn btn-ghost" href={signedIn ? "/app/equipe" : "/en/signup"}>{signedIn ? "My team" : "Get started"}</Link></div>
          </div>
        </div>
      </section>

      <section className="block" id="contact">
        <div className="wrap contact">
          <div>
            <span className="eyebrow">Contact</span>
            <h2>Let&apos;s talk about your project.</h2>
            <p className="muted" style={{ fontSize: 18, margin: "14px 0 0" }}>I reply within 24 hours with a first estimate.</p>
            <div className="coord">
              <a href="tel:+32477443988"><Phone className="ico" aria-hidden="true" />+32 477 44 39 88</a>
              <a href="mailto:info@skydev.be"><Mail className="ico" aria-hidden="true" />info@skydev.be</a>
              <div><MapPin className="ico" aria-hidden="true" />Belgium · working worldwide</div>
            </div>
          </div>
          <ContactFormEn />
        </div>
      </section>
    </>
  );
}
