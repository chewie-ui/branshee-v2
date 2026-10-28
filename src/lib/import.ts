/**
 * Import de clients et de produits depuis un fichier CSV ou Excel (pur, testé).
 * Reconnaît les en-têtes courants (français, néerlandais, anglais) des autres logiciels.
 */

export const MAX_ROWS = 5000;
export const MAX_COLS = 60;
export const MAX_CELL = 1000;

/**
 * Taille décompressée d'un .xlsx (archive zip) lue dans son répertoire central, sans rien décompresser :
 * protège contre les fichiers minuscules qui gonflent en centaines de Mo.
 */
export function zipStats(buf: Uint8Array): { entries: number; uncompressed: number } | null {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (v.getUint32(i, true) !== 0x06054b50) continue;
    const entries = v.getUint16(i + 10, true);
    let p = v.getUint32(i + 16, true);
    let total = 0;
    for (let k = 0; k < entries; k++) {
      if (p + 46 > buf.length || v.getUint32(p, true) !== 0x02014b50) return null;
      const size = v.getUint32(p + 24, true);
      if (size === 0xffffffff) return null; // zip64 : refusé
      total += size;
      p += 46 + v.getUint16(p + 28, true) + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
    }
    return { entries, uncompressed: total };
  }
  return null;
}

/** Lit un CSV (séparateur « ; », « , » ou tabulation détecté, guillemets, BOM, retours à la ligne dans les champs). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const counts = [";", ",", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  const sep = counts.sort((a, b) => b[1] - a[1])[0]![0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) { if (row.length < MAX_COLS) row.push(cell.slice(0, MAX_CELL)); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      if (row.length < MAX_COLS) row.push(cell.slice(0, MAX_CELL));
      // Seules les lignes non vides comptent ; au-delà de la limite, on s'arrête (l'appelant refuse le fichier).
      if (row.some((c) => c.trim())) rows.push(row);
      row = []; cell = "";
      if (rows.length > MAX_ROWS + 1) break;
    } else if (cell.length <= MAX_CELL) cell += ch;
  }
  if (cell !== "" || row.length) { if (row.length < MAX_COLS) row.push(cell.slice(0, MAX_CELL)); if (row.some((c) => c.trim())) rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim()));
}

export type ImportKind = "clients" | "produits";

export const FIELDS: Record<ImportKind, { key: string; label: string; aliases: string[] }[]> = {
  clients: [
    { key: "fullName", label: "Nom complet", aliases: ["nom complet", "full name", "name", "nom et prenom", "client", "contact", "naam", "volledige naam", "display name", "nom du client"] },
    { key: "firstName", label: "Prénom", aliases: ["prenom", "first name", "firstname", "given name", "voornaam"] },
    { key: "lastName", label: "Nom", aliases: ["nom", "last name", "lastname", "surname", "family name", "achternaam", "nom de famille"] },
    { key: "email", label: "Email", aliases: ["email", "e-mail", "mail", "courriel", "adresse email", "email address", "e-mailadres"] },
    { key: "phone", label: "Téléphone", aliases: ["telephone", "tel", "phone", "gsm", "mobile", "portable", "telefoon", "phone number", "numero de telephone"] },
    { key: "companyName", label: "Société", aliases: ["societe", "entreprise", "company", "company name", "bedrijf", "organisation", "raison sociale", "firma"] },
    { key: "vatNumber", label: "N° de TVA", aliases: ["tva", "n de tva", "numero de tva", "vat", "vat number", "btw", "btw-nummer", "num tva"] },
    { key: "street", label: "Rue et numéro", aliases: ["adresse", "rue", "address", "street", "straat", "adres", "address line 1"] },
    { key: "postalCode", label: "Code postal", aliases: ["code postal", "cp", "postal code", "zip", "postcode", "zip code"] },
    { key: "city", label: "Ville", aliases: ["ville", "localite", "city", "town", "gemeente", "stad", "commune"] },
    { key: "country", label: "Pays", aliases: ["pays", "country", "land"] },
  ],
  produits: [
    { key: "name", label: "Nom du produit", aliases: ["nom", "produit", "article", "name", "product", "product name", "naam", "libelle", "designation", "description"] },
    { key: "price", label: "Prix de vente TVAC", aliases: ["prix", "prix ttc", "prix tvac", "prix de vente", "price", "verkoopprijs", "prijs", "pv", "sale price", "retail price"] },
    { key: "vatRate", label: "TVA (%)", aliases: ["tva", "taux tva", "vat", "vat rate", "btw", "tax"] },
    { key: "sku", label: "Référence", aliases: ["reference", "ref", "sku", "code", "code article", "artikelnummer"] },
    { key: "barcode", label: "Code-barres", aliases: ["code barre", "code-barres", "codebarre", "ean", "barcode", "gtin", "upc", "streepjescode"] },
    { key: "category", label: "Catégorie", aliases: ["categorie", "category", "famille", "rayon", "categorie produit", "groep", "type"] },
    { key: "stockQty", label: "Stock", aliases: ["stock", "quantite", "qty", "quantity", "voorraad", "en stock", "inventory"] },
    { key: "minQty", label: "Seuil d'alerte", aliases: ["seuil", "stock minimum", "stock min", "min", "minimum", "alerte"] },
    { key: "cost", label: "Prix d'achat", aliases: ["prix d achat", "prix achat", "cout", "cost", "purchase price", "aankoopprijs", "pa"] },
    { key: "supplier", label: "Fournisseur", aliases: ["fournisseur", "supplier", "vendor", "leverancier", "marque"] },
  ],
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[°'’_.:/()-]+/g, " ").replace(/\s+/g, " ").trim();

/** Devine quelle colonne du fichier va dans quel champ (-1 = ignorée). Chaque colonne ne sert qu'une fois. */
export function guessMapping(headers: string[], kind: ImportKind): Record<string, number> {
  const h = headers.map(norm);
  const used = new Set<number>();
  const out: Record<string, number> = {};
  // Exact d'abord, puis « commence par / contient » pour les en-têtes un peu différents.
  for (const pass of ["exact", "loose"] as const) {
    for (const f of FIELDS[kind]) {
      if (out[f.key] !== undefined && out[f.key]! >= 0) continue;
      const idx = h.findIndex((x, i) => !used.has(i) && f.aliases.some((a) => (pass === "exact" ? x === a : x.length > 2 && (x.startsWith(a + " ") || x.endsWith(" " + a)))));
      out[f.key] = idx;
      if (idx >= 0) used.add(idx);
    }
  }
  return out;
}

/** Montant en euros (« 12,50 € », « 1.234,56 », « 12.5 ») → centimes ; null si illisible. */
export function parseMoney(v: string): number | null {
  let s = v.replace(/[€\s]|EUR/gi, "");
  if (!s) return null;
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n < 10_000_000 ? Math.round(n * 100) : null;
}

const cell = (row: string[], i: number | undefined) => (i !== undefined && i >= 0 ? (row[i] ?? "").trim() : "");
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

export type ClientRow = { fullName: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null; companyName: string | null; vatNumber: string | null; street: string | null; postalCode: string | null; city: string | null; country: string | null };
export type ProductRow = { name: string; priceCents: number; vatRate: number; sku: string | null; barcode: string | null; category: string | null; stockQty: number; minQty: number | null; costCents: number | null; supplier: string | null };
export type RowError = { line: number; reason: string };

/** Lignes du fichier → clients prêts à créer, et lignes refusées (avec la raison). */
export function toClients(rows: string[][], map: Record<string, number>) {
  const ok: ClientRow[] = [];
  const errors: RowError[] = [];
  rows.forEach((r, k) => {
    const g = (key: string, max = 200) => cell(r, map[key]).slice(0, max) || null;
    const first = g("firstName", 60);
    const last = g("lastName", 60);
    const company = g("companyName");
    const fullName = (g("fullName", 120) ?? [first, last].filter(Boolean).join(" ")) || company || "";
    const rawEmail = (g("email") ?? "").toLowerCase();
    if (!fullName) return errors.push({ line: k + 2, reason: "Pas de nom" });
    if (rawEmail && !isEmail(rawEmail)) return errors.push({ line: k + 2, reason: `Email invalide : ${rawEmail.slice(0, 60)}` });
    ok.push({ fullName: fullName.slice(0, 120), firstName: first, lastName: last, email: rawEmail || null, phone: g("phone", 40), companyName: company, vatNumber: g("vatNumber", 30), street: g("street"), postalCode: g("postalCode", 12), city: g("city", 80), country: g("country", 60) });
  });
  return { ok, errors };
}

export function toProducts(rows: string[][], map: Record<string, number>) {
  const ok: ProductRow[] = [];
  const errors: RowError[] = [];
  rows.forEach((r, k) => {
    const g = (key: string, max = 200) => cell(r, map[key]).slice(0, max) || null;
    const name = g("name", 120);
    if (!name) return errors.push({ line: k + 2, reason: "Pas de nom" });
    const priceRaw = g("price") ?? "";
    const price = priceRaw ? parseMoney(priceRaw) : 0;
    if (price === null) return errors.push({ line: k + 2, reason: `Prix illisible : ${priceRaw.slice(0, 30)}` });
    const vatRaw = Number((g("vatRate") ?? "21").replace(/[%\s]/g, "").replace(",", "."));
    const vat = vatRaw > 0 && vatRaw < 1 ? Math.round(vatRaw * 100) : Math.round(vatRaw);
    if (![0, 6, 12, 21].includes(vat)) return errors.push({ line: k + 2, reason: `TVA inconnue : ${g("vatRate")}` });
    const qty = Math.round(Number((g("stockQty") ?? "0").replace(",", ".")) || 0);
    const min = g("minQty");
    const costRaw = g("cost");
    ok.push({
      name,
      priceCents: price,
      vatRate: vat,
      sku: g("sku", 60),
      barcode: g("barcode", 40)?.replace(/\s/g, "") || null,
      category: g("category", 60),
      stockQty: Math.max(-100000, Math.min(1_000_000, qty)),
      minQty: min !== null && Number.isFinite(Number(min.replace(",", "."))) ? Math.max(0, Math.round(Number(min.replace(",", ".")))) : null,
      costCents: costRaw ? parseMoney(costRaw) : null,
      supplier: g("supplier", 120),
    });
  });
  return { ok, errors };
}
