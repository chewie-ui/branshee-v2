import { CUSTOM_SERVICES, SITE_FROM_EUR, type CustomService } from "@/lib/custom-services";
import type { SiteLocale } from "@/lib/site-locale";

/** Pages « sur mesure » en anglais (clients partout dans le monde, travail à distance). Slugs anglais. */
const COMMON_FAQ_EN = [
  { q: "How does a project work?", r: "We talk for 15 minutes (call or video), I send you an estimate within 24 hours, then a mock-up before you pay anything. The price is fixed and agreed before we start." },
  { q: "Do you work with clients outside Belgium?", r: "Yes. Skydev is based in Belgium and works remotely with clients everywhere, in English or French. Everything happens by video call, email and shared previews." },
  { q: "Can it connect to Skydev?", r: "If you want: bookings, shop, contact form, reviews and more can run directly from your Skydev space, securely." },
];

const EN: Record<string, Omit<CustomService, "villes" | "slug"> & { slugEn: string }> = {
  "creation-site-internet": {
    slugEn: "website-design", nom: "Website design", titre: "Custom website design",
    description: `Custom website from €${SITE_FROM_EUR}: fast, mobile-first, built for Google and connected to your bookings. Free estimate within 24 hours.`,
    intro: "A fast website that looks great on a phone, is built to be found on Google and turns visitors into clients: quote requests, bookings or online orders.",
    prix: `Showcase website from €${SITE_FROM_EUR}`,
    points: [
      { t: "Custom, not a template", d: "A design made for your business and your brand, approved on a mock-up before you pay." },
      { t: "Ready for Google", d: "Fast pages, structured content, Google Business Profile and local data done right." },
      { t: "Connected to your tools", d: "Online booking, contact form, reviews and shop wired to your space, no copy-pasting." },
      { t: "Live in about ten days", d: "For a classic showcase website, once texts and photos are ready." },
    ],
    faq: [{ q: "How much does a website cost?", r: `A showcase website starts at €${SITE_FROM_EUR}. The final price depends on the number of pages and features (booking, shop, several languages) and is fixed before we start.` }, ...COMMON_FAQ_EN],
  },
  "refonte-site-internet": {
    slugEn: "website-redesign", nom: "Website redesign", titre: "Website redesign",
    description: "Is your website slow, dated or not bringing in clients? A full redesign, mobile-first and built for Google, while keeping your rankings.",
    intro: "We start from your current website: what works is kept, the rest is rebuilt to be fast, clear and effective, without losing your place on Google.",
    prix: "Quote, fixed price",
    points: [
      { t: "Audit of the existing site", d: "Page views, searches that bring visitors, friction points: we know what to keep." },
      { t: "Rankings preserved", d: "Every old address is redirected to the matching new page." },
      { t: "Modern design", d: "Readable, fast, designed for phones first." },
      { t: "Connected to your tools", d: "Bookings, contact and reviews connected if you want." },
    ],
    faq: COMMON_FAQ_EN,
  },
  "boutique-en-ligne": {
    slugEn: "online-store", nom: "Online store", titre: "Custom online store",
    description: "A custom online store with online payments and stock shared with your point of sale. For shops, makers and brands.",
    intro: "Sell online with a store that looks like you, sharing the same stock as your shop: a sale online or at the counter updates everything.",
    prix: "Quote, fixed price",
    points: [
      { t: "Online payments", d: "Secure payment at checkout, pickup or delivery." },
      { t: "One stock", d: "Sizes, colours and quantities shared with your till." },
      { t: "Orders in one place", d: "Every order lands in your space, with an email to the client." },
      { t: "Small or large", d: "From a few products to a full catalogue with variants." },
    ],
    faq: COMMON_FAQ_EN,
  },
  "application-web-saas": {
    slugEn: "web-app-saas", nom: "Web apps & SaaS", titre: "Custom web app and SaaS development",
    description: "Custom web apps, business software and SaaS for small businesses and startups: client portals, internal tools, online platforms.",
    intro: "A tool that doesn't exist yet, or costs too much in subscriptions? We build it: client portal, internal tool, online platform, all the way to a SaaS you sell to others.",
    prix: "Quote, fixed price",
    points: [
      { t: "Built around your work", d: "We start from the way you work, not from generic software." },
      { t: "Secure", d: "Accounts, per-person permissions, encrypted sensitive data, backups." },
      { t: "Grows with you", d: "We start with the essentials, then add what you need." },
      { t: "Proven", d: "The whole Skydev platform — 25+ connected apps — is built this way." },
    ],
    faq: COMMON_FAQ_EN,
  },
  "application-mobile": {
    slugEn: "mobile-app", nom: "Mobile app", titre: "Mobile app development",
    description: "Custom iPhone and Android app for your business: bookings, loyalty, client tracking, field tool.",
    intro: "An app on your clients' or your team's phones: bookings, loyalty card, job tracking, taking photos in the field…",
    prix: "Quote, fixed price",
    points: [
      { t: "iPhone and Android", d: "One codebase for both, published on the stores." },
      { t: "Connected to your data", d: "The same clients, bookings and invoices as your Skydev space." },
      { t: "Notifications", d: "Reminders, confirmations and messages sent at the right time." },
      { t: "Ongoing support", d: "Publishing on the App Store and Google Play, then updates." },
    ],
    faq: COMMON_FAQ_EN,
  },
  "crm-logiciel-gestion": {
    slugEn: "crm-business-software", nom: "CRM & business software", titre: "Custom CRM and business software",
    description: "CRM, client tracking, quotes, scheduling: the Skydev platform from €29/month, or business software built for you.",
    intro: "Clients, quotes, scheduling, stock: the Skydev platform already covers the essentials from €29 a month. For a very specific need, we adapt it or build your own tool.",
    prix: "Platform from €29/month, custom on quote",
    points: [
      { t: "Ready right away", d: "Client database, quotes, sales pipeline, tasks: already in Skydev." },
      { t: "Adapted to you", d: "An app is missing? Describe it from your space and we build it." },
      { t: "Data import", d: "Clients and products imported from Excel or your old software." },
      { t: "Team and permissions", d: "Everyone only sees what concerns them." },
    ],
    faq: COMMON_FAQ_EN,
  },
  "automatisation-bots": {
    slugEn: "automation-ai", nom: "Automation & AI", titre: "Automation, bots and AI tools",
    description: "Automate repetitive work: emails, follow-ups, data entry, client replies, AI-powered tools. For freelancers and small businesses.",
    intro: "Follow-ups, copy-pasting between tools, answering the same questions: these tasks can run on their own and give you back hours every week.",
    prix: "Quote, fixed price",
    points: [
      { t: "Automatic follow-ups", d: "Unanswered quotes, unpaid invoices, appointments to confirm." },
      { t: "Tools that talk", d: "Your website, your accounting and Skydev connected together." },
      { t: "AI assistants", d: "Answers to common questions, sorting requests, call summaries." },
      { t: "You stay in control", d: "Every automation is explained and can be switched off anytime." },
    ],
    faq: COMMON_FAQ_EN,
  },
  "referencement-local-google": {
    slugEn: "local-seo", nom: "Local SEO", titre: "Local SEO on Google",
    description: "Show up on Google and Google Maps in your area: Business Profile, reviews, optimised website, local directories.",
    intro: "When someone searches for your trade near them, you need to show up: a polished Google profile, reviews, a clear website and the right directories.",
    prix: "Quote, fixed price",
    points: [
      { t: "Google Business Profile", d: "Categories, description, photos, hours and services filled in properly." },
      { t: "Client reviews", d: "A simple link to ask for them, and replies to reviews." },
      { t: "Optimised website", d: "Pages per service and per area, fast and well structured." },
      { t: "Directories", d: "Listed in the directories that matter in your country." },
    ],
    faq: COMMON_FAQ_EN,
  },
};

/** Prestation sur mesure dans une langue (le slug devient l'adresse anglaise en anglais). */
export function customServiceL(s: CustomService, locale: SiteLocale): CustomService {
  if (locale === "fr") return s;
  const e = EN[s.slug];
  if (!e) return s;
  const { slugEn, ...rest } = e;
  return { ...s, ...rest, slug: slugEn, villes: false };
}

/** Prestation par adresse, française ou anglaise. */
export function customServiceBySlugAny(slug: string): CustomService | null {
  return CUSTOM_SERVICES.find((s) => s.slug === slug || EN[s.slug]?.slugEn === slug) ?? null;
}

export const customServicesL = (locale: SiteLocale) => CUSTOM_SERVICES.map((s) => customServiceL(s, locale));
