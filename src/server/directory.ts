import "server-only";
import { cache } from "react";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { cap, knownMetiers, knownVilles, metierFromSlug, norm, villeFromSlug, type DirVille } from "@/lib/directory";
import { slugify } from "@/lib/slug";
import { declaredTypesAndCities, directoryCities, searchDirectory } from "@/server/site";

/** Métiers et villes de l'annuaire : liste fixe + ce que les pros inscrits ont déclaré (une requête par rendu). */
export const directoryVocabulary = cache(async () => {
  const d = await declaredTypesAndCities();
  const villes: DirVille[] = [...knownVilles()];
  for (const c of d.cities) {
    const slug = slugify(c);
    if (slug && !villes.some((v) => v.slug === slug)) villes.push({ slug, nom: cap(c.trim()) });
  }
  const metierNames = [...knownMetiers().map((m) => cap(m.nom))];
  for (const t of d.types) if (!metierNames.some((m) => norm(m) === norm(t))) metierNames.push(cap(t.trim()));
  return { ...d, villes, metierNames: metierNames.sort((a, b) => a.localeCompare(b, "fr")), villeNames: villes.map((v) => v.nom).sort((a, b) => a.localeCompare(b, "fr")) };
});


/** Page « métier » : métier reconnu, ses établissements et les villes où il est présent. */
export const metierPage = cache(async (slug: string, page = 1) => {
  const vocab = await directoryVocabulary();
  const metier = metierFromSlug(slug, vocab.types);
  if (!metier) return null;
  const [res, cities] = await Promise.all([searchDirectory({ keywords: metier.keywords, page }), directoryCities(metier.keywords)]);
  return { vocab, metier, res, cities };
});

/** Page « métier à ville » : établissements de la ville ; à défaut, ce métier ailleurs. */
export const metierVillePage = cache(async (mSlug: string, vSlug: string) => {
  const vocab = await directoryVocabulary();
  const metier = metierFromSlug(mSlug, vocab.types);
  const ville = villeFromSlug(vSlug, vocab.cities);
  if (!metier || !ville) return null;
  const [res, cities] = await Promise.all([searchDirectory({ keywords: metier.keywords, location: ville.nom, per: 48 }), directoryCities(metier.keywords)]);
  const elsewhere = res.total ? [] : (await searchDirectory({ keywords: metier.keywords, per: 6 })).rows;
  return { vocab, metier, ville, res, cities, elsewhere };
});

/** Ce qui est rempli sur la page publique d'un établissement (carte « Votre page » de l'accueil). */
export async function pageFacts(businessId: string) {
  const rows = await db.execute<{ photo: boolean; description: boolean; type: boolean; address: boolean; services: number; hours: boolean; reviews: number; city: string | null; btype: string | null }>(sql`
    select b.photo_url is not null as photo,
           coalesce(trim(b.description), '') <> '' as description,
           coalesce(trim(b.business_type), '') <> '' as type,
           coalesce(trim(b.city), '') <> '' as address,
           (select count(*)::int from services s where s.business_id = b.id and s.is_active) as services,
           exists (select 1 from weekly_hours h where h.business_id = b.id) as hours,
           (select count(*)::int from reviews r where r.business_id = b.id) as reviews,
           b.city, b.business_type as btype
    from businesses b where b.id = ${businessId}`);
  return rows[0] ?? null;
}
