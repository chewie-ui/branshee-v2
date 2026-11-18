import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { appointments, careDocuments, careEntries, careMeasures, careEpisodes, careTeamMembers, clientShares, customerNotes, customers, salesDocuments } from "@/db/schema";
import { decrypt } from "@/lib/field-crypto";
import type { AppContext } from "@/server/context";

const safe = (v: string | null) => {
  try {
    return decrypt(v);
  } catch {
    return null;
  }
};

/**
 * Export complet et lisible (JSON) du dossier d'un patient : identité, rendez-vous, notes, dossier kiné avec
 * toutes les versions, mesures, documents, factures, partages. Format documenté dans l'aide (format-export).
 */
export async function patientExport(ctx: AppContext, c: typeof customers.$inferSelect) {
  const [appts, notes, episodes, docs, shares, team, careDocs] = await Promise.all([
    db.select().from(appointments).where(and(eq(appointments.customerId, c.id), eq(appointments.businessId, ctx.business.id))).orderBy(asc(appointments.startsAt)),
    db.select().from(customerNotes).where(eq(customerNotes.customerId, c.id)).orderBy(asc(customerNotes.date)),
    db.select().from(careEpisodes).where(and(eq(careEpisodes.customerId, c.id), eq(careEpisodes.businessId, ctx.business.id))).orderBy(asc(careEpisodes.createdAt)),
    db.select().from(salesDocuments).where(and(eq(salesDocuments.customerId, c.id), eq(salesDocuments.businessId, ctx.business.id))).orderBy(asc(salesDocuments.issueDate)),
    db.select().from(clientShares).where(and(eq(clientShares.customerId, c.id), eq(clientShares.businessId, ctx.business.id))).orderBy(asc(clientShares.createdAt)),
    db.select().from(careTeamMembers).where(and(eq(careTeamMembers.customerId, c.id), eq(careTeamMembers.businessId, ctx.business.id))).orderBy(asc(careTeamMembers.createdAt)),
    db.select().from(careDocuments).where(and(eq(careDocuments.customerId, c.id), eq(careDocuments.businessId, ctx.business.id))).orderBy(asc(careDocuments.docKey), asc(careDocuments.version)),
  ]);
  const all = episodes.length ? await db.select().from(careEntries).where(inArray(careEntries.episodeId, episodes.map((e) => e.id))).orderBy(asc(careEntries.entryKey), asc(careEntries.version)) : [];
  // Données confidentielles : exportées seulement pour leur auteur (auteur de la première version).
  const owner = new Map<string, string | null>();
  for (const x of all) if (!owner.has(x.entryKey)) owner.set(x.entryKey, x.authorUserId);
  const hidden = new Set(all.filter((x) => x.confidential && owner.get(x.entryKey) !== ctx.user.id).map((x) => x.entryKey));
  const entries = all.filter((x) => !hidden.has(x.entryKey));
  const measures = episodes.length ? await db.select().from(careMeasures).where(inArray(careMeasures.episodeId, episodes.map((e) => e.id))).orderBy(asc(careMeasures.measuredOn)) : [];
  return {
    format: "skydev-patient-export",
    version: 2,
    documentation: "/app/aide/dossier-kine#format-export",
    exportedAt: new Date().toISOString(),
    business: { id: ctx.business.id, name: ctx.business.name },
    patient: {
      id: c.id, fullName: c.fullName, firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone,
      niss: safe(c.nissEnc), birthDate: c.birthDate, sex: c.sex, mutuality: c.mutuality, mutualityNumber: c.mutualityNumber, ct1: c.ct1, ct2: c.ct2, language: c.language,
      address: { street: c.street, postalCode: c.postalCode, city: c.city, country: c.country },
      prescriber: { name: c.prescriberName, inami: c.prescriberInami }, generalPractitioner: { name: c.gpName, inami: c.gpInami },
      generalInfo: safe(c.generalInfoEnc), archivedAt: c.archivedAt, createdAt: c.createdAt,
    },
    appointments: appts.map((a) => ({ id: a.id, startsAt: a.startsAt, endsAt: a.endsAt, service: a.serviceName, status: a.status, noShow: a.noShow })),
    notes: notes.map((n) => ({ id: n.id, date: n.date, title: n.title, note: safe(n.noteEnc), todo: safe(n.todoEnc), attachment: n.attachmentName })),
    careEpisodes: episodes.map((e) => ({
      id: e.id, title: e.title, prescriber: { name: e.prescriberName, inami: e.prescriberInami }, prescriptionDate: e.prescriptionDate,
      sessionsPrescribed: e.sessionsPrescribed, pathologyKind: e.pathologyKind, nomenclature: e.nomenclature,
      approval: { start: e.approvalStart, end: e.approvalEnd }, status: e.status, closedAt: e.closedAt, createdAt: e.createdAt,
      entries: entries.filter((x) => x.episodeId === e.id).map((x) => ({ key: x.entryKey, section: x.section, version: x.version, date: x.entryDate, deleted: !!x.deleted, confidential: !!x.confidential, lifecycle: x.passive ? "passive" : "active", codes: x.codes, content: safe(x.contentEnc), author: x.authorName, at: x.createdAt })),
      measures: measures.filter((m) => m.episodeId === e.id).map((m) => ({ key: m.measureKey, label: m.label, value: m.value, unit: m.unit, side: m.side, date: m.measuredOn, author: m.authorName, deletedAt: m.deletedAt })),
    })),
    careTeam: team.map((m) => ({ role: m.role, name: m.name, profession: m.profession, inami: m.inami, enterpriseNumber: m.enterpriseNumber, address: m.address, phone: m.phone, email: m.email, iban: m.iban })),
    careDocuments: careDocs.map((d) => ({ key: d.docKey, version: d.version, kind: d.kind, title: d.title, episodeId: d.episodeId, recipient: { name: d.recipientName, inami: d.recipientInami }, status: d.status, validatedAt: d.validatedAt, author: d.authorName, content: safe(d.contentEnc), at: d.createdAt })),
    invoices: docs.filter((d) => d.number).map((d) => ({ type: d.docType, number: d.number, status: d.status, issueDate: d.issueDate, totalCents: d.ttcCents })),
    sharedWithPatient: shares.map((s) => ({ kind: s.kind, title: s.title, content: s.kind === "note" ? safe(s.bodyEnc) : null, file: s.fileName, at: s.createdAt })),
  };
}
