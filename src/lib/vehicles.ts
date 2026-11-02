/**
 * App Véhicules (pur, testé) : libellés, formats et calculs d'une fiche véhicule (garages et négociants, Belgique).
 */
import { slugify } from "@/lib/slug";

export const VEHICLE_STATUS = {
  draft: { label: "Brouillon", tone: "neutral", public: false },
  for_sale: { label: "En vente", tone: "success", public: true },
  reserved: { label: "Réservé", tone: "warning", public: true },
  sold: { label: "Vendu", tone: "neutral", public: false },
} as const;
export type VehicleStatus = keyof typeof VEHICLE_STATUS;
export const isVehicleStatus = (s: unknown): s is VehicleStatus => typeof s === "string" && s in VEHICLE_STATUS;

export const FUELS = { essence: "Essence", diesel: "Diesel", hybride: "Hybride", hybride_rechargeable: "Hybride rechargeable", electrique: "Électrique", lpg: "LPG", cng: "CNG", autre: "Autre" } as const;
export const GEARBOXES = { manuelle: "Manuelle", automatique: "Automatique" } as const;
export const BODY_TYPES = { citadine: "Citadine", berline: "Berline", break: "Break", suv: "SUV / 4x4", monospace: "Monospace", coupe: "Coupé", cabriolet: "Cabriolet", utilitaire: "Utilitaire", pickup: "Pick-up", moto: "Moto", autre: "Autre" } as const;
export const EURO_NORMS = ["Euro 1", "Euro 2", "Euro 3", "Euro 4", "Euro 5", "Euro 6", "Euro 6d"] as const;

export type Fuel = keyof typeof FUELS;
export type Gearbox = keyof typeof GEARBOXES;
export type BodyType = keyof typeof BODY_TYPES;

/** Équipements fréquents, proposés en un clic (le garagiste peut en ajouter d'autres). */
export const EQUIPMENT_SUGGESTIONS: Record<string, string[]> = {
  Confort: ["Climatisation", "Climatisation automatique", "Sièges chauffants", "Volant chauffant", "Toit ouvrant", "Toit panoramique", "Sièges en cuir", "Hayon électrique", "Démarrage sans clé"],
  "Aide à la conduite": ["Régulateur de vitesse", "Régulateur adaptatif", "Capteurs de stationnement", "Caméra de recul", "Caméra 360°", "Aide au maintien de voie", "Détecteur d'angle mort", "Freinage d'urgence", "Stationnement automatique"],
  Multimédia: ["GPS", "Apple CarPlay", "Android Auto", "Bluetooth", "Écran tactile", "Système audio premium", "Recharge sans fil"],
  Extérieur: ["Jantes alliage", "Phares LED", "Phares xénon", "Vitres teintées", "Attelage", "Barres de toit", "Peinture métallisée"],
};

/** 1 kW = 1,35962 ch (arrondi à l'unité, comme sur les annonces). */
export const kwToHp = (kw: number) => Math.round(kw * 1.35962);

export const formatKm = (km: number | null | undefined) => (km == null ? null : `${new Intl.NumberFormat("fr-BE").format(km)} km`);

export const formatPrice = (cents: number | null | undefined) =>
  cents == null ? "Prix sur demande" : new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(cents / 100));

/** « 2021-03 » → « 03/2021 ». */
export const formatRegistration = (ym: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym ?? "");
  return m ? `${m[2]}/${m[1]}` : null;
};
export const registrationYear = (ym: string | null | undefined) => (/^\d{4}/.exec(ym ?? "")?.[0] ? Number(ym!.slice(0, 4)) : null);

export const formatPower = (kw: number | null | undefined) => (kw == null ? null : `${kw} kW (${kwToHp(kw)} ch)`);

export type VehicleLike = { make: string; model: string; version?: string | null };
export const vehicleTitle = (v: VehicleLike) => [v.make, v.model].map((s) => s.trim()).filter(Boolean).join(" ");
export const vehicleFullTitle = (v: VehicleLike) => [vehicleTitle(v), v.version?.trim()].filter(Boolean).join(" ");

/** Adresse lisible et unique : « volkswagen-golf-1-5-tsi-2021 » (+ suffixe si déjà pris). */
export function vehicleSlug(v: VehicleLike & { firstRegistration?: string | null }, taken: (s: string) => boolean) {
  const base = slugify([v.make, v.model, v.version, registrationYear(v.firstRegistration)].filter(Boolean).join(" ")).slice(0, 80) || "vehicule";
  if (!taken(base)) return base;
  for (let i = 2; i < 1000; i++) if (!taken(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now().toString(36)}`;
}

/** Équipements : nettoyés, sans doublon (casse ignorée), 80 maximum. */
export function cleanEquipment(list: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const e = raw.replace(/\s+/g, " ").trim().slice(0, 60);
    const k = e.toLowerCase();
    if (e && !seen.has(k)) {
      seen.add(k);
      out.push(e);
    }
    if (out.length >= 80) break;
  }
  return out;
}

/** Numéro de châssis (VIN) : 17 caractères, sans I, O ni Q. */
export const isVin = (s: string) => /^[A-HJ-NPR-Z0-9]{17}$/.test(s.toUpperCase());

/** Caractéristiques affichées sur la fiche publique, dans l'ordre (les vides sont omis). */
export function publicSpecs(v: {
  firstRegistration: string | null; mileageKm: number | null; fuel: string | null; gearbox: string | null; powerKw: number | null; engineCc: number | null;
  bodyType: string | null; color: string | null; interior: string | null; doors: number | null; seats: number | null; co2: number | null; euroNorm: string | null; owners: number | null;
}) {
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value: string | null | undefined) => { if (value) rows.push({ label, value }); };
  add("1re immatriculation", formatRegistration(v.firstRegistration));
  add("Kilométrage", formatKm(v.mileageKm));
  add("Carburant", v.fuel ? (FUELS as Record<string, string>)[v.fuel] ?? v.fuel : null);
  add("Boîte de vitesses", v.gearbox ? (GEARBOXES as Record<string, string>)[v.gearbox] ?? v.gearbox : null);
  add("Puissance", formatPower(v.powerKw));
  add("Cylindrée", v.engineCc ? `${new Intl.NumberFormat("fr-BE").format(v.engineCc)} cm³` : null);
  add("Carrosserie", v.bodyType ? (BODY_TYPES as Record<string, string>)[v.bodyType] ?? v.bodyType : null);
  add("Couleur", v.color);
  add("Intérieur", v.interior);
  add("Portes", v.doors ? String(v.doors) : null);
  add("Places", v.seats ? String(v.seats) : null);
  add("Émissions CO₂", v.co2 != null ? `${v.co2} g/km` : null);
  add("Norme Euro", v.euroNorm);
  add("Propriétaires précédents", v.owners != null ? String(v.owners) : null);
  return rows;
}

/**
 * Prix d'un véhicule tapé en euros : « 18990 », « 18 990 », « 18.990 » (point des milliers belge), « 18 990,50 ».
 * Renvoie des centimes, ou null si illisible.
 */
export function parseCarPrice(raw: string): number | null {
  let t = raw.replace(/[\s  €]/g, "");
  if (!t) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t)) t = t.replace(/\./g, "");
  t = t.replace(",", ".");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}
