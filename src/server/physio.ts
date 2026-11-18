import "server-only";
import { and, asc, desc, eq, gte, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointments, careEntries, careEpisodes, careMeasures, recordAccessLogs } from "@/db/schema";
import { decrypt } from "@/lib/field-crypto";
import type { AppContext } from "@/server/context";

/** Sections du dossier kiné, dans l'ordre du déroulé de soins. */
export const CARE_SECTIONS = [
  { key: "anamnese", label: "Anamnèse", hint: "Motif de consultation, plaintes, antécédents, examens déjà faits, traitements en cours, kiné antérieure.", multi: false },
  { key: "examen", label: "Examen kinésithérapeutique", hint: "Observation, palpation, mesures et tests (amplitudes, force, douleur EVA…).", multi: false },
  { key: "diagnostic", label: "Diagnostic kiné", hint: "Interprétation : déficiences, sévérité, facteurs personnels et environnementaux, attentes du patient, indication du traitement.", multi: false },
  { key: "plan", label: "Plan de traitement", hint: "Objectifs, soins prévus, fréquence et durée, cadre réglementaire.", multi: false },
  { key: "evaluation", label: "Évaluations", hint: "Évolution du patient, son avis, conclusion (poursuite, adaptation, arrêt).", multi: true },
  { key: "acte", label: "Séances et consignes", hint: "Actes réalisés (code de nomenclature), consignes données au patient.", multi: true },
  { key: "concertation", label: "Concertations multidisciplinaires", hint: "Date, participants et disciplines, type de contact, contenu, conclusion.", multi: true },
  { key: "hospitalisation", label: "Hospitalisations", hint: "Entrée et sortie (date, heure), service, hôpital, motif.", multi: true },
  { key: "cloture", label: "Clôture", hint: "Raison de l'arrêt, participation du patient, suite proposée, conseils.", multi: false },
] as const;
export type CareSection = (typeof CARE_SECTIONS)[number]["key"];
export const isCareSection = (s: string): s is CareSection => CARE_SECTIONS.some((x) => x.key === s);

export const PATHOLOGY_KINDS = [
  { key: "courante", label: "Pathologie courante" },
  { key: "E", label: "Pathologie lourde (liste E)" },
  { key: "Fa", label: "Liste Fa" },
  { key: "Fb", label: "Liste Fb" },
  { key: "perinatal", label: "Rééducation périnatale" },
  { key: "palliatif", label: "Patient palliatif" },
  { key: "11bis", label: "Situation 11bis" },
  { key: "autre", label: "Autre situation" },
] as const;

const safe = (v: string | null) => {
  try {
    return decrypt(v) ?? "";
  } catch {
    return "";
  }
};

/** Trace l'accès à un dossier patient (ouverture, modification, export, impression). */
export async function logRecordAccess(ctx: AppContext, customerId: string | null, action: "view" | "edit" | "export" | "print", detail?: string) {
  if (ctx.impersonating) return;
  await db.insert(recordAccessLogs).values({ businessId: ctx.business.id, customerId, userId: ctx.user.id, userName: ctx.user.name, action, detail: detail?.slice(0, 200) ?? null }).catch(() => {});
}

export async function episodeOf(businessId: string, id: string) {
  const [e] = await db.select().from(careEpisodes).where(and(eq(careEpisodes.id, id), eq(careEpisodes.businessId, businessId)));
  return e ?? null;
}

export async function episodesOf(businessId: string, customerId: string) {
  return db.select().from(careEpisodes).where(and(eq(careEpisodes.businessId, businessId), eq(careEpisodes.customerId, customerId))).orderBy(desc(careEpisodes.createdAt));
}

/** Séances honorées pendant l'épisode (de la prescription à la clôture), pour le compteur « 12 / 18 ». */
export async function sessionsDone(e: typeof careEpisodes.$inferSelect) {
  const from = e.prescriptionDate ? new Date(`${e.prescriptionDate}T00:00:00Z`) : e.createdAt;
  const to = e.closedAt ?? new Date();
  const rows = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.customerId, e.customerId), eq(appointments.businessId, e.businessId), eq(appointments.kind, "appointment"), eq(appointments.status, "confirmed"), eq(appointments.noShow, false), gte(appointments.startsAt, from), lte(appointments.endsAt, to), ne(appointments.status, "cancelled")));
  return rows.length;
}

export type CareEntryView = { key: string; section: CareSection; version: number; content: string; date: string | null; author: string; at: Date; versions: number; confidential: boolean; passive: boolean; mine: boolean; codes: { scheme: string; code: string; label?: string }[] };

/**
 * Dernière version de chaque donnée du dossier (les supprimées sont exclues, l'historique reste en base).
 * Les données confidentielles ne sont rendues qu'à leur auteur (`viewerId`) ; sans lecteur, elles sont exclues
 * (documents destinés à des tiers).
 */
export async function currentEntries(episodeId: string, viewerId: string | null = null): Promise<CareEntryView[]> {
  const rows = await db.select().from(careEntries).where(eq(careEntries.episodeId, episodeId)).orderBy(asc(careEntries.entryKey), desc(careEntries.version));
  const latest = new Map<string, typeof rows[number]>();
  const count = new Map<string, number>();
  for (const r of rows) {
    count.set(r.entryKey, (count.get(r.entryKey) ?? 0) + 1);
    if (!latest.has(r.entryKey)) latest.set(r.entryKey, r);
  }
  return [...latest.values()]
    .filter((r) => !r.deleted && isCareSection(r.section) && (!r.confidential || (viewerId != null && confidentialOwner(rows, r.entryKey) === viewerId)))
    .map((r) => ({ key: r.entryKey, section: r.section as CareSection, version: r.version, content: safe(r.contentEnc), date: r.entryDate, author: r.authorName, at: r.createdAt, versions: count.get(r.entryKey) ?? 1, confidential: !!r.confidential, passive: !!r.passive, mine: viewerId != null && r.authorUserId === viewerId, codes: r.codes ?? [] }))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.at.getTime() - b.at.getTime());
}

/** Auteur d'une donnée confidentielle = auteur de sa première version (seul à pouvoir la lire). */
function confidentialOwner(rows: { entryKey: string; version: number; authorUserId: string | null }[], key: string) {
  let first: { version: number; authorUserId: string | null } | null = null;
  for (const r of rows) if (r.entryKey === key && (!first || r.version < first.version)) first = r;
  return first?.authorUserId ?? null;
}

/** Une donnée confidentielle est-elle lisible par cet utilisateur ? */
export async function canReadEntry(entryKey: string, userId: string) {
  const rows = await db.select({ entryKey: careEntries.entryKey, version: careEntries.version, authorUserId: careEntries.authorUserId, confidential: careEntries.confidential }).from(careEntries).where(eq(careEntries.entryKey, entryKey));
  if (!rows.some((r) => r.confidential)) return true;
  return confidentialOwner(rows, entryKey) === userId;
}

/** Historique complet d'une donnée (toutes ses versions, la plus récente d'abord). */
export async function entryHistory(businessId: string, entryKey: string) {
  const rows = await db.select().from(careEntries).where(and(eq(careEntries.businessId, businessId), eq(careEntries.entryKey, entryKey))).orderBy(desc(careEntries.version));
  return rows.map((r) => ({ version: r.version, content: safe(r.contentEnc), deleted: !!r.deleted, author: r.authorName, at: r.createdAt, date: r.entryDate, confidential: !!r.confidential, passive: !!r.passive, codes: r.codes ?? [] }));
}

export async function episodesSessionCounts(episodes: (typeof careEpisodes.$inferSelect)[]) {
  return Object.fromEntries(await Promise.all(episodes.map(async (e) => [e.id, await sessionsDone(e)] as const)));
}


/** Mesures d'un épisode (les supprimées incluses, marquées). */
export async function measuresOf(episodeId: string) {
  return db.select().from(careMeasures).where(eq(careMeasures.episodeId, episodeId)).orderBy(asc(careMeasures.measuredOn), asc(careMeasures.createdAt));
}
