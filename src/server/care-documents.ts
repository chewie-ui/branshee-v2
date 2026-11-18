import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { careDocuments, careEpisodes, careTeamMembers, customers } from "@/db/schema";
import { decrypt } from "@/lib/field-crypto";
import { formatNiss } from "@/lib/niss";
import { TO_FILL, careDocLabel, type CareDocKind } from "@/lib/care-team";
import { PATHOLOGY_KINDS, currentEntries, measuresOf, sessionsDone, type CareEntryView } from "@/server/physio";

const safe = (v: string | null) => {
  try {
    return decrypt(v) ?? "";
  } catch {
    return "";
  }
};
const day = (iso?: string | null) => (iso ? iso.split("-").reverse().join("/") : "");
const kindLabel = (k: string) => PATHOLOGY_KINDS.find((x) => x.key === k)?.label ?? k;

type Customer = typeof customers.$inferSelect;
type Episode = typeof careEpisodes.$inferSelect;

/** Dernière version de chaque document du patient (le plus récent d'abord). */
export async function latestDocuments(businessId: string, customerId: string) {
  const rows = await db.select().from(careDocuments).where(and(eq(careDocuments.businessId, businessId), eq(careDocuments.customerId, customerId))).orderBy(asc(careDocuments.docKey), desc(careDocuments.version));
  const latest = new Map<string, (typeof rows)[number] & { versions: number }>();
  for (const r of rows) {
    const cur = latest.get(r.docKey);
    if (!cur) latest.set(r.docKey, { ...r, versions: 1 });
    else cur.versions++;
  }
  return [...latest.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function documentVersions(businessId: string, docKey: string) {
  return db.select().from(careDocuments).where(and(eq(careDocuments.businessId, businessId), eq(careDocuments.docKey, docKey))).orderBy(desc(careDocuments.version));
}

export const documentContent = (d: { contentEnc: string | null }) => safe(d.contentEnc);

function patientBlock(c: Customer) {
  const niss = c.nissEnc ? formatNiss(safe(c.nissEnc)) : "";
  return [
    `Patient : ${c.fullName}${c.birthDate ? `, né(e) le ${day(c.birthDate)}` : ""}`,
    `NISS : ${niss || TO_FILL}`,
    `Mutuelle : ${c.mutuality || TO_FILL}${c.mutualityNumber ? ` (n° ${c.mutualityNumber})` : ""}${c.ct1 || c.ct2 ? ` · CT1/CT2 ${c.ct1 ?? "—"}/${c.ct2 ?? "—"}` : ""}`,
    [c.street, [c.postalCode, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") ? `Adresse : ${[c.street, [c.postalCode, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}` : null,
  ].filter(Boolean).join("\n");
}

const pick = (entries: CareEntryView[], section: string) => entries.filter((x) => x.section === section && !x.passive);
const join = (items: CareEntryView[], dated = false) => (items.length ? items.map((x) => (dated && x.date ? `${day(x.date)} — ${x.content}` : x.content)).join("\n") : TO_FILL);
const lastOf = (items: CareEntryView[]) => (items.length ? items[items.length - 1]!.content : TO_FILL);

function episodeBlock(e: Episode, done: number) {
  return [
    `Motif : ${e.title} (${kindLabel(e.pathologyKind)})`,
    `Prescription : ${e.prescriptionDate ? `du ${day(e.prescriptionDate)}` : TO_FILL}${e.prescriberName ? `, ${e.prescriberName}` : ""}${e.prescriberInami ? ` (INAMI ${e.prescriberInami})` : ""}`,
    `Séances réalisées : ${done}${e.sessionsPrescribed ? ` sur ${e.sessionsPrescribed} prescrites` : ""}`,
    e.nomenclature ? `Nomenclature : ${e.nomenclature}` : null,
    e.approvalStart || e.approvalEnd ? `Accord / notification : du ${day(e.approvalStart) || "—"} au ${day(e.approvalEnd) || "—"}` : null,
  ].filter(Boolean).join("\n");
}

/**
 * Pré-remplit un document INAMI depuis le dossier (identité, prescription, contenu du dossier kiné).
 * Les données confidentielles ne sont jamais reprises ; ce qui manque est marqué « [à compléter] ».
 */
/** Évolution des mesures d'un épisode, une ligne par paramètre : « Douleur (EVA) : 7/10 (01/11) → 3/10 (15/11) ». */
export async function measuresSummary(episodeId: string) {
  const ms = (await measuresOf(episodeId)).filter((m) => !m.deletedAt);
  const groups = new Map<string, typeof ms>();
  for (const m of ms) {
    const k = `${m.label}${m.side ? ` (${m.side === "G" ? "gauche" : "droit"})` : ""}`;
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }
  const fmt = (m: (typeof ms)[number]) => `${m.value}${m.unit && !m.unit.startsWith("/") ? " " : ""}${m.unit ?? ""} (${day(m.measuredOn).slice(0, 5)})`;
  return [...groups.entries()].map(([k, list]) => `${k} : ${list.length > 1 ? `${fmt(list[0]!)} → ${fmt(list[list.length - 1]!)}` : fmt(list[0]!)}`);
}

export async function buildDocument(kind: CareDocKind, c: Customer, e: Episode | null, author: string, authorInami: string | null = null): Promise<{ title: string; recipientName: string | null; recipientInami: string | null; content: string }> {
  const entries = e ? await currentEntries(e.id) : [];
  const done = e ? await sessionsDone(e) : 0;
  const prescriber = { name: e?.prescriberName ?? c.prescriberName ?? null, inami: e?.prescriberInami ?? c.prescriberInami ?? null };
  const label = careDocLabel(kind);
  const title = e ? `${label} — ${e.title}` : label;
  const P = patientBlock(c);
  const E = e ? episodeBlock(e, done) : "";
  const sign = `\n${author}${authorInami ? `\nKinésithérapeute, INAMI ${authorInami}` : ""}`;
  const measures = e ? await measuresSummary(e.id) : [];
  // Les mesures complètent l'examen ; si l'examen est vide (ou confidentiel), elles suffisent à le remplir.
  const withMeasures = (text: string) => {
    if (!measures.length) return text;
    const list = `Mesures :\n${measures.join("\n")}`;
    return text === TO_FILL ? list : `${text}\n${list}`;
  };
  switch (kind) {
    case "rapport_prescripteur":
      return {
        title,
        recipientName: prescriber.name,
        recipientInami: prescriber.inami,
        content: [
          `Cher Confrère,\n\nVoici le rapport ${e?.status === "closed" ? "de fin de traitement" : "intermédiaire"} concernant votre patient(e).`,
          P, E,
          "DIAGNOSTIC KINÉ", join(pick(entries, "diagnostic")),
          "EXAMEN", withMeasures(join(pick(entries, "examen"))),
          "TRAITEMENT", join(pick(entries, "plan")),
          "ÉVOLUTION", join(pick(entries, "evaluation"), true),
          "CONCLUSION", e?.status === "closed" ? join(pick(entries, "cloture")) : TO_FILL,
          `Confraternellement,${sign}`,
        ].join("\n\n"),
      };
    case "rapport_ecrit": {
      const gp = c.gpName ? { name: c.gpName, inami: c.gpInami } : prescriber;
      return {
        title,
        recipientName: gp.name,
        recipientInami: gp.inami ?? null,
        content: [
          "Rapport écrit dans le cadre de la continuité des soins.",
          P, E,
          "MOTIF", join(pick(entries, "anamnese")),
          "DIAGNOSTIC KINÉ", join(pick(entries, "diagnostic")),
          "TRAITEMENT", join(pick(entries, "plan")),
          "ÉVOLUTION", join(pick(entries, "evaluation"), true),
          "CONSEILS ET SUITE", join([...pick(entries, "cloture"), ...pick(entries, "acte").slice(-1)]),
          `Bien à vous,${sign}`,
        ].join("\n\n"),
      };
    }
    case "seances_supp":
      return {
        title,
        recipientName: prescriber.name,
        recipientInami: prescriber.inami,
        content: [
          "Demande de séances supplémentaires de kinésithérapie.",
          P, E,
          "JUSTIFICATION", `Diagnostic : ${lastOf(pick(entries, "diagnostic"))}\nDernière évaluation : ${lastOf(pick(entries, "evaluation"))}${measures.length ? `\nMesures :\n${measures.join("\n")}` : ""}`,
          "OBJECTIFS RESTANTS", lastOf(pick(entries, "plan")),
          "SÉANCES DEMANDÉES", `Nombre de séances supplémentaires : ${TO_FILL}\nFréquence : ${TO_FILL}`,
          `Je reste à votre disposition pour tout renseignement.${sign}`,
        ].join("\n\n"),
      };
    case "notification_fa_fb":
      return {
        title,
        recipientName: c.mutuality ? `Médecin-conseil — ${c.mutuality}` : "Médecin-conseil de la mutuelle",
        recipientInami: null,
        content: [
          "Notification d'une pathologie de la liste Fa / Fb (art. 7 de la nomenclature). À transmettre au médecin-conseil avec le formulaire officiel et la prescription.",
          P, E,
          "PATHOLOGIE", `Liste : ${e?.pathologyKind === "Fa" || e?.pathologyKind === "Fb" ? e.pathologyKind : TO_FILL}\nSituation pathologique : ${e?.title ?? TO_FILL}\nDiagnostic : ${lastOf(pick(entries, "diagnostic"))}`,
          "DATE DE DÉBUT", `Premier traitement le : ${day(e?.approvalStart) || TO_FILL}\nDate de la prescription : ${day(e?.prescriptionDate) || TO_FILL}`,
          `Fait le ${"[date]"},${sign}`,
        ].join("\n\n"),
      };
    case "demande_e":
      return {
        title,
        recipientName: c.mutuality ? `Médecin-conseil — ${c.mutuality}` : "Médecin-conseil de la mutuelle",
        recipientInami: null,
        content: [
          "Demande d'accord pour une pathologie lourde (liste E). À joindre au formulaire officiel et au rapport du médecin spécialiste.",
          P, E,
          "PATHOLOGIE", `Situation pathologique : ${e?.title ?? TO_FILL}\nDiagnostic kiné : ${lastOf(pick(entries, "diagnostic"))}`,
          "JUSTIFICATION", `Bilan : ${lastOf(pick(entries, "examen"))}\nPlan de traitement : ${lastOf(pick(entries, "plan"))}`,
          "PÉRIODE DEMANDÉE", `Du ${day(e?.approvalStart) || TO_FILL} au ${day(e?.approvalEnd) || TO_FILL}`,
          `Fait le [date],${sign}`,
        ].join("\n\n"),
      };
    case "bilan":
      return {
        title,
        recipientName: prescriber.name,
        recipientInami: prescriber.inami,
        content: [
          "Rapport de bilan kinésithérapeutique.",
          P, E,
          "ANAMNÈSE", join(pick(entries, "anamnese")),
          "EXAMEN", withMeasures(join(pick(entries, "examen"))),
          "DIAGNOSTIC KINÉ", join(pick(entries, "diagnostic")),
          "PROPOSITION DE TRAITEMENT", join(pick(entries, "plan")),
          `Confraternellement,${sign}`,
        ].join("\n\n"),
      };
    case "historique": {
      const eps = await db.select().from(careEpisodes).where(and(eq(careEpisodes.customerId, c.id), eq(careEpisodes.businessId, c.businessId))).orderBy(asc(careEpisodes.createdAt));
      const lines = await Promise.all(eps.map(async (x) => `${day(x.prescriptionDate) || day(x.createdAt.toISOString().slice(0, 10))} — ${x.title} (${kindLabel(x.pathologyKind)}) · ${await sessionsDone(x)} séance(s)${x.status === "closed" ? " · clôturé" : " · en cours"}`));
      return { title: label, recipientName: null, recipientInami: null, content: [P, "PATHOLOGIES TRAITÉES", lines.length ? lines.join("\n") : "Aucun épisode de soins.", sign.trim()].join("\n\n") };
    }
    default:
      return { title: label, recipientName: null, recipientInami: null, content: [P, TO_FILL, `Bien à vous,${sign}`].join("\n\n") };
  }
}

/** Équipe de soins du patient. */
export async function careTeamOf(businessId: string, customerId: string) {
  return db.select().from(careTeamMembers).where(and(eq(careTeamMembers.businessId, businessId), eq(careTeamMembers.customerId, customerId))).orderBy(asc(careTeamMembers.role), asc(careTeamMembers.name));
}
