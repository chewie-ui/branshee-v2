/**
 * Référencement local des pages de réservation : titre « Nom — Métier à Ville », description utile
 * et données structurées schema.org (type d'établissement, adresse, horaires, avis réels, réservation).
 */

/** Type schema.org le plus précis selon le métier déclaré (texte libre : on cherche des mots-clés). */
export function schemaTypeFor(businessType: string | null) {
  const t = (businessType ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/kine|physio/.test(t)) return "Physiotherapy";
  if (/osteo|podolog|psycholog|medecin|infirmi|dentist|logoped|dieteti|sage-femme|chiropr/.test(t)) return "MedicalBusiness";
  if (/coiff|barb/.test(t)) return "HairSalon";
  if (/esthet|beaute|ongl|manucur|maquill|cils/.test(t)) return "BeautySalon";
  if (/tatou|tattoo|piercing/.test(t)) return "TattooParlor";
  if (/mass|spa|bien-etre|reflexo|sophro/.test(t)) return "HealthAndBeautyBusiness";
  if (/coach|sport|fitness|yoga|pilates/.test(t)) return "SportsActivityLocation";
  return "LocalBusiness";
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** « Morgane Forzée — Kinésithérapeute à Wavre » (sans répéter ce que le nom contient déjà). */
export function localTitle(name: string, businessType: string | null, city: string | null) {
  const n = name.toLowerCase();
  const parts = [businessType && !n.includes(businessType.toLowerCase()) ? cap(businessType) : null, city && !n.includes(city.toLowerCase()) ? `à ${city}` : null].filter(Boolean);
  return parts.length ? `${name} — ${parts.join(" ")}` : name;
}

export function localDescription(name: string, businessType: string | null, city: string | null) {
  const who = [businessType ? businessType.toLowerCase() : null, city ? `à ${city}` : null].filter(Boolean).join(" ");
  return `Prenez rendez-vous en ligne avec ${name}${who ? `, ${who}` : ""}. Disponibilités en temps réel, confirmation immédiate et rappel avant le rendez-vous.`;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type JsonLdInput = {
  url: string;
  name: string;
  businessType: string | null;
  description: string | null;
  photoUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  hours: { weekday: number; start: string; end: string }[];
  reviews: { count: number; average: number | null };
  services: { name: string; priceCents: number | null }[];
};

/** Données structurées de l'établissement : uniquement des informations réelles saisies par le pro. */
export function businessJsonLd(b: JsonLdInput) {
  const abs = (u: string | null) => (u ? (/^https?:\/\//.test(u) ? u : new URL(u, b.url).toString()) : undefined);
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaTypeFor(b.businessType),
    "@id": `${b.url}#etablissement`,
    name: b.name,
    url: b.url,
    description: b.description ?? undefined,
    image: abs(b.photoUrl),
    telephone: b.phone ?? undefined,
    email: b.email ?? undefined,
    address:
      b.address || b.city
        ? { "@type": "PostalAddress", streetAddress: b.address ?? undefined, postalCode: b.postalCode ?? undefined, addressLocality: b.city ?? undefined, addressCountry: b.country ?? "BE" }
        : undefined,
    openingHoursSpecification: b.hours.length ? b.hours.map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: DAYS[h.weekday], opens: h.start, closes: h.end })) : undefined,
    aggregateRating: b.reviews.count > 0 && b.reviews.average ? { "@type": "AggregateRating", ratingValue: Number(b.reviews.average.toFixed(1)), reviewCount: b.reviews.count, bestRating: 5, worstRating: 1 } : undefined,
    makesOffer: b.services.length
      ? b.services.slice(0, 20).map((s) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: s.name }, ...(s.priceCents ? { price: (s.priceCents / 100).toFixed(2), priceCurrency: "EUR" } : {}) }))
      : undefined,
    potentialAction: { "@type": "ReserveAction", target: { "@type": "EntryPoint", urlTemplate: b.url, actionPlatform: ["https://schema.org/DesktopWebPlatform", "https://schema.org/MobileWebPlatform"] }, result: { "@type": "Reservation", name: "Rendez-vous" } },
  };
  // `</script>` impossible dans le JSON injecté.
  return JSON.stringify(data, (_k, v) => (v === undefined ? undefined : v)).replace(/</g, "\\u003c");
}
