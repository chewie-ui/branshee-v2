/**
 * Factures électroniques Peppol (UBL 2.1, Peppol BIS Billing 3.0) : obligatoires en Belgique entre entreprises
 * assujetties depuis le 1er janvier 2026. Génère le XML à partir d'une facture émise (pur, testé).
 */
import { r2, totals, type SalesLine } from "./invoicing";

type Party = { [k: string]: string | number | undefined };
export type UblInput = {
  docType: "invoice" | "credit";
  number: string;
  issueDate: string;
  dueDate: string | null;
  serviceDate: string | null;
  comm: string | null;
  notes: string;
  lines: SalesLine[];
  seller: Party;
  client: Party;
  relatedNumber?: string | null;
};

// Caractères de contrôle interdits en XML 1.0 retirés, puis échappement.
// eslint-disable-next-line no-control-regex
const x = (v: unknown) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const a = (n: number) => r2(n).toFixed(2);
const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const s = (v: unknown) => String(v ?? "").trim();
/** Nombre sans arrondi visible (prix unitaire : jusqu'à 6 décimales permises par Peppol). */
const dec = (n: number) => String(Math.round(n * 1e6) / 1e6);

const COUNTRIES: Record<string, string> = {
  belgique: "BE", belgium: "BE", belgie: "BE", belgien: "BE", france: "FR", frankrijk: "FR", "pays-bas": "NL", nederland: "NL", netherlands: "NL",
  luxembourg: "LU", luxemburg: "LU", allemagne: "DE", deutschland: "DE", germany: "DE", duitsland: "DE", espagne: "ES", espana: "ES", spain: "ES",
  italie: "IT", italia: "IT", italy: "IT", portugal: "PT", "royaume-uni": "GB", "united kingdom": "GB", suisse: "CH", schweiz: "CH", switzerland: "CH",
  autriche: "AT", irlande: "IE", pologne: "PL", danemark: "DK", suede: "SE", "etats-unis": "US", "united states": "US",
};
/** Code pays ISO 3166 à 2 lettres (Belgique par défaut quand rien n'est indiqué). */
export function countryCode(v: unknown) {
  const raw = s(v);
  if (!raw) return "BE";
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const k = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return COUNTRIES[k] ?? "BE";
}

/** N° d'entreprise belge (10 chiffres) tiré d'un n° de TVA « BE0123456789 » ou d'un BCE « 0123.456.789 ». */
export function enterpriseNumber(p: Party) {
  const raw = s(p.bce) || s(p.vat) || s(p.vatNumber);
  if (/^(BE)?\s*[01]?[\d.\s]{9,12}$/i.test(raw)) {
    const d = digits(raw);
    return d.length === 9 ? `0${d}` : d.length === 10 ? d : null;
  }
  return null;
}
const vatId = (p: Party) => { const v = s(p.vat) || s(p.vatNumber); return /^[A-Z]{2}/i.test(v) ? v.replace(/[\s.]/g, "").toUpperCase() : null; };

/** Ce qui manque pour envoyer en Peppol (vide = prêt). */
export function ublMissing(i: UblInput) {
  const m: string[] = [];
  if (!s(i.seller.legalName) && !s(i.seller.tradeName)) m.push("nom de votre entreprise");
  if (!enterpriseNumber(i.seller)) m.push("votre n° d'entreprise (BCE)");
  if (s(i.seller.vatRegime) === "assujetti" && !vatId(i.seller)) m.push("votre n° de TVA (BE…)");
  if (!s(i.seller.street) || !s(i.seller.city) || !s(i.seller.zip)) m.push("votre adresse");
  if (!s(i.client.name)) m.push("nom du client");
  if (!enterpriseNumber(i.client) && !vatId(i.client)) m.push("n° de TVA ou d'entreprise du client");
  if (!s(i.client.city)) m.push("adresse du client");
  return m;
}

function party(p: Party, role: "AccountingSupplierParty" | "AccountingCustomerParty", name: string) {
  const ent = enterpriseNumber(p);
  const vat = vatId(p);
  const country = countryCode(p.country);
  return `<cac:${role}><cac:Party>${ent ? `<cbc:EndpointID schemeID="0208">${ent}</cbc:EndpointID>` : vat ? `<cbc:EndpointID schemeID="9925">${x(vat)}</cbc:EndpointID>` : ""}<cac:PartyName><cbc:Name>${x(name)}</cbc:Name></cac:PartyName><cac:PostalAddress>${s(p.street) ? `<cbc:StreetName>${x(p.street)}</cbc:StreetName>` : ""}${s(p.city) ? `<cbc:CityName>${x(p.city)}</cbc:CityName>` : ""}${s(p.zip) ? `<cbc:PostalZone>${x(p.zip)}</cbc:PostalZone>` : ""}<cac:Country><cbc:IdentificationCode>${country}</cbc:IdentificationCode></cac:Country></cac:PostalAddress>${vat ? `<cac:PartyTaxScheme><cbc:CompanyID>${x(vat)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ""}<cac:PartyLegalEntity><cbc:RegistrationName>${x(name)}</cbc:RegistrationName>${ent ? `<cbc:CompanyID schemeID="0208">${ent}</cbc:CompanyID>` : ""}</cac:PartyLegalEntity>${s(p.email) ? `<cac:Contact><cbc:ElectronicMail>${x(p.email)}</cbc:ElectronicMail></cac:Contact>` : ""}</cac:Party></cac:${role}>`;
}

export function buildUbl(i: UblInput) {
  const franchise = s(i.seller.vatRegime || "franchise") === "franchise";
  const t = totals(i.lines, franchise ? "franchise" : "assujetti");
  const credit = i.docType === "credit";
  const root = credit ? "CreditNote" : "Invoice";
  const ns = credit ? "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2" : "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
  const sellerName = s(i.seller.legalName) || s(i.seller.tradeName);
  const cat = (rate: number) => (franchise ? "E" : rate === 0 ? "Z" : "S");
  const exemption = franchise ? `<cbc:TaxExemptionReason>Régime particulier de franchise des petites entreprises</cbc:TaxExemptionReason>` : "";
  const subtotals = franchise
    ? `<cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">${a(t.ht)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">0.00</cbc:TaxAmount><cac:TaxCategory><cbc:ID>E</cbc:ID><cbc:Percent>0</cbc:Percent>${exemption}<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`
    : t.vatRows.map((r) => `<cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">${a(r.base)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">${a(r.amt)}</cbc:TaxAmount><cac:TaxCategory><cbc:ID>${cat(r.rate)}</cbc:ID><cbc:Percent>${r.rate}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`).join("");
  const rows = i.lines.filter((l) => s(l.desc) || Number(l.price));
  const lineTag = credit ? "CreditNoteLine" : "InvoiceLine";
  const qtyTag = credit ? "CreditedQuantity" : "InvoicedQuantity";
  const lines = rows.map((l, k) => {
    // Peppol refuse un prix négatif (remise) : la quantité porte le signe. Montant de ligne = celui des totaux.
    const q0 = Number(l.qty) || 0;
    const p0 = Number(l.price) || 0;
    const qty = p0 < 0 ? -q0 : q0;
    const price = Math.abs(p0);
    const rate = franchise ? 0 : Number(l.vat) || 0;
    return `<cac:${lineTag}><cbc:ID>${k + 1}</cbc:ID><cbc:${qtyTag} unitCode="C62">${dec(qty)}</cbc:${qtyTag}><cbc:LineExtensionAmount currencyID="EUR">${a(q0 * p0)}</cbc:LineExtensionAmount><cac:Item><cbc:Name>${x(s(l.desc).slice(0, 200) || "Prestation")}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>${cat(rate)}</cbc:ID><cbc:Percent>${rate}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="EUR">${dec(price)}</cbc:PriceAmount></cac:Price></cac:${lineTag}>`;
  }).join("");
  const iban = s(i.seller.iban).replace(/\s/g, "");
  const payment = !credit && iban ? `<cac:PaymentMeans><cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>${i.comm ? `<cbc:PaymentID>${x(i.comm)}</cbc:PaymentID>` : ""}<cac:PayeeFinancialAccount><cbc:ID>${x(iban)}</cbc:ID>${s(i.seller.bic) ? `<cac:FinancialInstitutionBranch><cbc:ID>${x(i.seller.bic)}</cbc:ID></cac:FinancialInstitutionBranch>` : ""}</cac:PayeeFinancialAccount></cac:PaymentMeans>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<${root} xmlns="${ns}" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID><cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID><cbc:ID>${x(i.number)}</cbc:ID><cbc:IssueDate>${i.issueDate}</cbc:IssueDate>${!credit && i.dueDate ? `<cbc:DueDate>${i.dueDate}</cbc:DueDate>` : ""}<cbc:${credit ? "CreditNoteTypeCode" : "InvoiceTypeCode"}>${credit ? 381 : 380}</cbc:${credit ? "CreditNoteTypeCode" : "InvoiceTypeCode"}>${s(i.notes) ? `<cbc:Note>${x(s(i.notes).slice(0, 1000))}</cbc:Note>` : ""}<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode><cbc:BuyerReference>${x(i.number)}</cbc:BuyerReference>${credit && i.relatedNumber ? `<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${x(i.relatedNumber)}</cbc:ID></cac:InvoiceDocumentReference></cac:BillingReference>` : ""}
${party(i.seller, "AccountingSupplierParty", sellerName)}
${party(i.client, "AccountingCustomerParty", s(i.client.name))}
${i.serviceDate && !credit ? `<cac:Delivery><cbc:ActualDeliveryDate>${i.serviceDate}</cbc:ActualDeliveryDate></cac:Delivery>` : ""}${payment}
<cac:TaxTotal><cbc:TaxAmount currencyID="EUR">${a(t.tva)}</cbc:TaxAmount>${subtotals}</cac:TaxTotal>
<cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="EUR">${a(t.ht)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="EUR">${a(t.ht)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="EUR">${a(t.ttc)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="EUR">${a(t.ttc)}</cbc:PayableAmount></cac:LegalMonetaryTotal>
${lines}
</${root}>`;
}
