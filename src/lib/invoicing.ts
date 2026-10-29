/**
 * Règles de facturation belges, reprises de Comptoir : totaux, numérotation continue, communication
 * structurée, contrôles IBAN / n° d'entreprise, QR de paiement (EPC). Partagé serveur / interface.
 */
import type { PartySnapshot, SalesLine } from "@/db/schema/invoicing";

export type { SalesLine, PartySnapshot };
export type DocType = "invoice" | "credit" | "quote";
export type DocStatus = "draft" | "sent" | "paid" | "cancelled" | "accepted" | "refused" | "invoiced";
export type VatRegime = "franchise" | "assujetti";

export const FRANCHISE_LIMIT = 25000;
export const UNITS = ["forfait", "heure", "jour", "séance", "mois", "pièce", "page"] as const;
export const VAT_RATES = [21, 12, 6, 0] as const;
export const PAID_METHODS = ["Virement", "Bancontact", "Carte", "Espèces", "Payconiq"] as const;

export const r2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const num = (v: unknown) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const EUR = new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" });
export const money = (n: number) => EUR.format(r2(n || 0));
export const moneyCents = (c: number) => money((c || 0) / 100);
export const pad = (n: number, l = 3) => String(n).padStart(l, "0");
export const fdate = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");

export function todayIso(tz = "Europe/Brussels") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + Number(n));
  return d.toISOString().slice(0, 10);
}
export const daysBetween = (a: string, b: string) => Math.round((new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime()) / 86400000);

export type Totals = { ht: number; tva: number; ttc: number; vatRows: { rate: number; base: number; amt: number }[] };

/** Totaux d'un document. En franchise, aucune TVA n'est facturée (total = hors TVA). */
export function totals(lines: SalesLine[], regime: VatRegime): Totals {
  const fr = regime === "franchise";
  let ht = 0;
  const vat: Record<number, number> = {};
  for (const l of lines) {
    const lht = r2(num(l.qty) * num(l.price));
    ht += lht;
    if (!fr) {
      const rate = num(l.vat);
      vat[rate] = (vat[rate] || 0) + lht;
    }
  }
  ht = r2(ht);
  let tva = 0;
  const vatRows = Object.keys(vat)
    .map(Number)
    .sort((a, b) => b - a)
    .map((rate) => {
      const base = r2(vat[rate]!);
      const amt = r2((base * rate) / 100);
      tva += amt;
      return { rate, base, amt };
    });
  tva = r2(tva);
  return { ht, tva, ttc: r2(ht + tva), vatRows };
}

export const cleanLines = (lines: SalesLine[]) => lines.filter((l) => String(l.desc).trim() || num(l.price));

/** « PREFIXE-2026-001 », « NC-2026-001 » pour les notes de crédit, « D-2026-001 » pour les devis. */
export function formatNumber(type: DocType, year: number, seq: number, prefix = "") {
  if (type === "quote") return `D-${year}-${pad(seq)}`;
  const p = prefix.trim();
  return `${p ? p + "-" : ""}${type === "credit" ? "NC-" : ""}${year}-${pad(seq)}`;
}

/** Communication structurée belge : 10 chiffres + modulo 97 → +++123/4567/89012+++. */
export function structComm(year: number, seq: number, type: DocType) {
  const base = String(year) + (type === "credit" ? "2" : "1") + pad(seq, 5);
  let mod = Number(base) % 97;
  if (mod === 0) mod = 97;
  const d = base + pad(mod, 2);
  return `+++${d.slice(0, 3)}/${d.slice(3, 7)}/${d.slice(7, 12)}+++`;
}

export function ibanValid(iban: string) {
  const s = String(iban || "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(s)) return false;
  const r = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let m = 0;
  for (const ch of r) m = (m * 10 + Number(ch)) % 97;
  return m === 1;
}
export const ibanFmt = (iban: string) =>
  String(iban || "")
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/(.{4})/g, "$1 ")
    .trim();

export function bceValid(v: string) {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length !== 10 || !/^[01]/.test(d)) return false;
  return 97 - (Number(d.slice(0, 8)) % 97) === Number(d.slice(8));
}
export const bceFmt = (v: string) => {
  const d = String(v || "").replace(/\D/g, "");
  return d.length === 10 ? `${d.slice(0, 4)}.${d.slice(4, 7)}.${d.slice(7)}` : v;
};

export type SellerSettings = {
  legalName: string;
  tradeName: string;
  legalForm: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  bce: string;
  vatNumber: string;
  email: string;
  phone: string;
  website: string;
  iban: string;
  bic: string;
  vatRegime: VatRegime;
  paymentDays: number;
  prefix: string;
  defaultNotes: string;
  footerNote: string;
  color: string;
};

/** Mentions obligatoires manquantes pour émettre une facture. */
/** Mentions obligatoires du vendeur sur une facture belge (et l'IBAN, pour être payé). */
export function settingsMissing(s: Pick<SellerSettings, "legalName" | "street" | "zip" | "city" | "bce"> & Partial<Pick<SellerSettings, "vatRegime" | "vatNumber" | "iban">>) {
  const miss: string[] = [];
  if (!s.legalName) miss.push("votre nom ou raison sociale");
  if (!s.street || !s.zip || !s.city) miss.push("votre adresse");
  if (!s.bce) miss.push("votre numéro d'entreprise");
  if (s.vatRegime === "assujetti" && !s.vatNumber && !s.bce) miss.push("votre numéro de TVA");
  if ("iban" in s && !s.iban) miss.push("votre IBAN");
  return miss;
}

/**
 * Mentions obligatoires du client sur une facture : nom et adresse complète ; pour une société, son numéro
 * de TVA ou d'entreprise.
 */
export function clientMissing(c: { name?: string | null; company?: string | null; vatNumber?: string | null; street?: string | null; postalCode?: string | null; city?: string | null }) {
  const miss: string[] = [];
  if (!(c.company || c.name)?.trim()) miss.push("le nom");
  if (!c.street?.trim()) miss.push("la rue et le numéro");
  if (!c.postalCode?.trim()) miss.push("le code postal");
  if (!c.city?.trim()) miss.push("la ville");
  if (c.company?.trim() && !c.vatNumber?.trim()) miss.push("le numéro de TVA ou d'entreprise de la société");
  return miss;
}

/** Contenu du QR de paiement européen (EPC / SEPA), lu par les apps bancaires belges. */
export function epcPayload(seller: { iban?: unknown; bic?: unknown; tradeName?: unknown; legalName?: unknown }, amount: number, comm: string) {
  const iban = String(seller.iban ?? "");
  if (!iban || !ibanValid(iban) || amount <= 0) return null;
  return ["BCD", "002", "1", "SCT", String(seller.bic ?? "").replace(/\s/g, ""), String(seller.tradeName || seller.legalName || "").slice(0, 70), iban.replace(/\s/g, "").toUpperCase(), "EUR" + amount.toFixed(2), "", "", comm.slice(0, 140), ""].join("\n");
}

export type DocState = "draft" | "open" | "overdue" | "paid" | "cancelled" | "issued" | "sent" | "accepted" | "refused" | "invoiced" | "expired";

export function docState(d: { docType: DocType; status: DocStatus; dueDate: string | null; validUntil: string | null }, today: string): DocState {
  if (d.docType === "quote") {
    if (d.status === "sent" && d.validUntil && d.validUntil < today) return "expired";
    return d.status as DocState;
  }
  if (d.status === "draft") return "draft";
  if (d.status === "paid") return "paid";
  if (d.status === "cancelled") return "cancelled";
  if (d.docType === "credit") return "issued";
  if (d.dueDate && d.dueDate < today) return "overdue";
  return "open";
}

export const STATE_LABEL: Record<DocState, [string, "neutral" | "accent" | "success" | "warning" | "danger"]> = {
  draft: ["Brouillon", "neutral"],
  open: ["À encaisser", "accent"],
  overdue: ["En retard", "danger"],
  paid: ["Payée", "success"],
  cancelled: ["Annulée", "neutral"],
  issued: ["Émise", "accent"],
  sent: ["Envoyé", "accent"],
  accepted: ["Accepté", "success"],
  refused: ["Refusé", "danger"],
  invoiced: ["Facturé", "neutral"],
  expired: ["Expiré", "warning"],
};

export const docTitle = (type: DocType) => (type === "quote" ? "Devis" : type === "credit" ? "Note de crédit" : "Facture");

export const newLine = (): SalesLine => ({ id: Math.random().toString(36).slice(2, 10), desc: "", qty: 1, unit: "forfait", price: 0, vat: 21 });

/** Texte d'email prêt à copier (envoi ou relance), comme dans Comptoir. */
export function mailText(d: { docType: DocType; number: string | null; ttc: number; dueDate: string | null; comm: string | null; validUntil: string | null }, seller: string, iban: string, reminder = false) {
  if (d.docType === "quote")
    return `Bonjour,\n\nVous trouverez en pièce jointe notre devis ${d.number ?? ""} d'un montant de ${money(d.ttc)}${d.validUntil ? `, valable jusqu'au ${fdate(d.validUntil)}` : ""}.\n\nN'hésitez pas si vous avez la moindre question.\n\nBien à vous,\n${seller}`;
  if (reminder)
    return `Bonjour,\n\nSauf erreur de notre part, la facture ${d.number} de ${money(d.ttc)}, échue le ${fdate(d.dueDate)}, n'a pas encore été réglée.\n\nMerci d'effectuer le virement sur le compte ${ibanFmt(iban)} avec la communication ${d.comm ?? ""}.\nSi le paiement a été fait entre-temps, merci de ne pas tenir compte de ce message.\n\nBien à vous,\n${seller}`;
  return `Bonjour,\n\nVous trouverez en pièce jointe la facture ${d.number} d'un montant de ${money(d.ttc)}, à régler avant le ${fdate(d.dueDate)}.\n\nCompte : ${ibanFmt(iban)}\nCommunication : ${d.comm ?? ""}\n\nMerci pour votre confiance.\n${seller}`;
}
