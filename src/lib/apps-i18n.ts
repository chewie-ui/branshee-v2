import type { AppCategory, AppId, SkyApp } from "@/lib/apps";
import type { SiteLocale } from "@/lib/site-locale";

/**
 * Apps en anglais et pays où elles fonctionnent.
 * « be » : liée aux règles belges (TVA, mentions légales, secrétariats sociaux, numéros belges) ;
 * « eu » : paiements en euros (zone euro) ; « world » : utilisable partout.
 */
export type AppReach = "world" | "eu" | "be";

export const APP_REACH: Record<AppId, AppReach> = {
  rdv: "world", clients: "world", site: "world", factures: "be", employes: "world", boutique: "eu", vehicules: "world",
  "tel-ia": "be", "sur-mesure": "world", horaires: "world", conges: "world", commandes: "world", paie: "be", ventes: "world",
  projets: "world", interventions: "world", stock: "world", caisse: "world", depenses: "be", compta: "be", marketing: "world",
  avis: "world", fidelite: "world", signature: "world", documents: "world", taches: "world", messagerie: "world", reglages: "world",
};

/** Libellé court de la zone (badge du catalogue). */
export const REACH_LABEL: Record<SiteLocale, Record<Exclude<AppReach, "world">, string>> = {
  fr: { be: "Belgique uniquement", eu: "Zone euro" },
  en: { be: "Belgium only", eu: "Eurozone" },
};

/** L'app est-elle utilisable dans ce pays (code ISO 2 lettres) ? */
export function appAvailableIn(id: AppId, country: string | null | undefined): boolean {
  const reach = APP_REACH[id];
  const c = (country || "BE").toUpperCase();
  if (reach === "world") return true;
  if (reach === "be") return c === "BE";
  return EUROZONE.has(c);
}

const EUROZONE = new Set(["AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES"]);

export const CATEGORY_LABEL_EN: Record<AppCategory, string> = {
  clients: "Clients & sales", finance: "Finance", equipe: "Team", operations: "Operations", marketing: "Marketing", services: "Services", systeme: "Settings",
};
export const BILLING_LABEL_EN: Record<SkyApp["billing"], string> = { included: "Included", addon: "Add-on", quote: "Custom quote", system: "" };

const EN: Record<AppId, { name: string; tagline: string; features: string[] }> = {
  rdv: { name: "Bookings", tagline: "Clients book online, 24/7.", features: ["Calendar and booking page", "Automatic reminders", "Card guarantee and deposits", "Client database"] },
  clients: { name: "Clients", tagline: "Your client database, shared by every app.", features: ["Client records and history", "Notes and documents", "Import and export", "Shared by Bookings, Invoices and Shop"] },
  site: { name: "Website", tagline: "Your website, connected to your bookings.", features: ["Website built from your details", "Your own domain name (option)", "Built-in booking button", "Optimised for Google"] },
  factures: { name: "Invoices", tagline: "Compliant quotes and invoices in a few clicks.", features: ["Quotes and invoices with Belgian legal mentions", "Automatic numbering", "PDF and payment QR code", "Payment tracking and reminders"] },
  employes: { name: "Employees", tagline: "Your team, their access and roles.", features: ["Team members, invitations and access", "Roles and permissions", "Employee files and contracts (soon)", "Linked to Schedule, Time off and Payroll"] },
  boutique: { name: "Shop", tagline: "Sell your products online.", features: ["Your Stock products for sale online", "Pickup or delivery, your own fees", "Card payment, bank transfer or pay in store", "Orders and stock tracked live"] },
  vehicules: { name: "Vehicles", tagline: "Your cars for sale, in a showroom.", features: ["Full listing: mileage, power, options, history", "Up to 30 photos per vehicle", "Online showroom and a page per car, ready for Google", "Enquiries received in your messages"] },
  "tel-ia": { name: "AI Phone", tagline: "An AI answers when you can't pick up.", features: ["Answers your missed calls", "Summary of every call by email", "You keep your number", "100 minutes included per month"] },
  "sur-mesure": { name: "Custom", tagline: "Whatever you need, built for you.", features: ["Custom websites and online shops", "Web and mobile apps, business software, CRM", "Automations and AI-powered tools", "Mock-up first, then a fixed price agreed upfront"] },
  horaires: { name: "Schedule", tagline: "Your team's hours, week by week.", features: ["Weekly schedule, per person or day by day", "Several people and days at once", "Excel export and print (PDF)", "In Google Calendar, Apple or Outlook"] },
  conges: { name: "Time off", tagline: "Leave requests, approval and balances.", features: ["Online request, one-click approval", "Balances per person, working days and Belgian public holidays", "Team absence calendar", "Closed days blocked in Bookings and shown in Schedule"] },
  commandes: { name: "Table ordering", tagline: "Guests order by scanning a QR code.", features: ["A printable QR code per table", "Online menu with photos and allergens", "Orders sent to the kitchen live", "Guests follow their order on their phone"] },
  paie: { name: "Payroll", tagline: "The month's hours, ready for your payroll provider.", features: ["Hours from Schedule, absences from Time off", "Meal vouchers, bonuses and mileage", "Indicative gross pay per person", "Excel export for Belgian payroll providers"] },
  ventes: { name: "Sales", tagline: "Prospect, then follow your leads to the signature.", features: ["Prospecting: call list, one-click outcomes, script and stats", "Leads in columns, drag from one stage to the next", "Today's follow-ups: nothing slips through", "One-click quote from a lead", "Revenue forecast and win rate"] },
  projets: { name: "Projects", tagline: "Projects, jobs and team tasks.", features: ["Tasks in columns, drag and drop", "Due dates and owners", "Time tracking: timer or quick entry", "Bill your time in one click"] },
  interventions: { name: "Field jobs", tagline: "Your technicians in the field.", features: ["Job schedule per technician", "Job sheet signed on the phone", "Before and after photos", "Invoice created in one click"] },
  stock: { name: "Stock", tagline: "Your products and quantities, always up to date.", features: ["Inventory and low-stock email alerts", "Receipts, outgoings and history", "Barcode scanning with the phone camera", "Linked to Point of sale: stock drops with every sale"] },
  caisse: { name: "Point of sale", tagline: "Take payments at the counter, card or cash.", features: ["Till on a tablet, phone or computer", "Cash with change, or card", "Printable receipts and end-of-day Z report", "Stock updated with every sale"] },
  depenses: { name: "Expenses", tagline: "Your receipts and purchase invoices, sorted.", features: ["Photo of the receipt or PDF, encrypted on our servers", "Recoverable Belgian VAT calculated", "Breakdown by category", "Export for your accountant"] },
  compta: { name: "Accounting", tagline: "Prepare your VAT return and follow your cash.", features: ["Income, till and expenses in one place", "Help with the Belgian VAT return", "Invoices to collect and late payments", "Export for your accountant"] },
  marketing: { name: "Marketing", tagline: "Emails to your clients, in a few clicks.", features: ["Email campaigns to all or some of your clients", "Win back clients you haven't seen in a while", "Ready-made templates, first name added automatically", "One-click unsubscribe, GDPR-compliant"] },
  avis: { name: "Google reviews", tagline: "More reviews, a better rating.", features: ["Automatic review request after every appointment", "QR code to display at the counter", "Private feedback: clients can also write to you directly", "Track requests and clicks to Google"] },
  fidelite: { name: "Loyalty", tagline: "Scannable stamp cards and gift cards.", features: ["Stamp card on the client's phone", "Clients scan a QR code to get their stamp", "Automatic stamp after an appointment or a purchase", "Reward of your choice at the goal", "Printable gift cards, usable in several goes", "Track active cards and amounts to honour"] },
  signature: { name: "E-signature", tagline: "Get your quotes signed online.", features: ["Clients sign on their phone, no account needed", "Proof: name, signature, date, IP and document fingerprint", "Signed quote = accepted, ready to invoice", "Tracking: sent, opened, signed or declined"] },
  documents: { name: "Documents", tagline: "All your files, shared with the team.", features: ["Folders and subfolders, drag and drop", "Files encrypted on our servers (2 GB)", "Share by link, with an expiry date", "Search across every folder"] },
  taches: { name: "Tasks", tagline: "Your to-dos and your team's, in one place.", features: ["Quick add: “Call Mark tomorrow 2pm #Site @Luke”", "Shared or private lists, subtasks, priorities", "Tasks assigned to a colleague, notified by email", "Recurring: every Monday, every month…"] },
  messagerie: { name: "Chat", tagline: "Talk with your team, without WhatsApp.", features: ["Team channels and private messages", "Unread messages highlighted", "Separate from your personal messages", "On phone and computer"] },
  reglages: { name: "Settings", tagline: "Business, subscription, account and help.", features: [] },
};

/** Nom, accroche et fonctions d'une app dans une langue. */
export function appText(app: Pick<SkyApp, "id" | "name" | "tagline" | "features">, locale: SiteLocale) {
  if (locale === "fr") return { name: app.name, tagline: app.tagline, features: app.features };
  return EN[app.id] ?? { name: app.name, tagline: app.tagline, features: app.features };
}
