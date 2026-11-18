import "server-only";
import { and, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { careInbox, customers } from "@/db/schema";

type Item = typeof careInbox.$inferSelect;
type Customer = typeof customers.$inferSelect;

const norm = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
/** Même personne au sens du nom : tous les mots de l'un se retrouvent dans l'autre (ordre libre). */
const sameName = (a: string | null, b: string | null) => {
  const x = norm(a).split(" ").filter(Boolean);
  const y = new Set(norm(b).split(" ").filter(Boolean));
  return x.length > 0 && x.every((w) => y.has(w));
};

/**
 * Rapprochement d'un document reçu avec un patient : d'abord par NISS (empreinte), sinon par nom + date de naissance.
 * Les conflits (NISS identique mais nom ou date différents) sont signalés et doivent être confirmés.
 */
export async function inboxMatch(businessId: string, item: Item, chosen?: Customer) {
  let suggested: Customer | null = null;
  let byNiss = false;
  if (item.patientNissHash) {
    const [c] = await db.select().from(customers).where(and(eq(customers.businessId, businessId), eq(customers.nissHash, item.patientNissHash)));
    if (c) {
      suggested = c;
      byNiss = true;
    }
  }
  if (!suggested && item.patientName && item.patientBirthDate) {
    const last = item.patientName.split(/\s+/).pop() ?? "";
    const rows = last.length > 1 ? await db.select().from(customers).where(and(eq(customers.businessId, businessId), eq(customers.birthDate, item.patientBirthDate), ilike(customers.fullName, `%${last.replace(/[%_\\]/g, "")}%`))).limit(5) : [];
    suggested = rows.find((r) => sameName(item.patientName, r.fullName)) ?? null;
  }
  const target = chosen ?? suggested;
  const conflicts: string[] = [];
  if (target) {
    if (item.patientNissHash && target.nissHash && target.nissHash !== item.patientNissHash) conflicts.push("le NISS du document diffère de celui de la fiche");
    if (chosen && suggested && byNiss && chosen.id !== suggested.id && !chosen.nissHash) conflicts.push(`ce NISS appartient à la fiche de ${suggested.fullName}`);
    if (item.patientName && !sameName(item.patientName, target.fullName) && !sameName(target.fullName, item.patientName)) conflicts.push(`nom différent (« ${item.patientName} » / « ${target.fullName} »)`);
    if (item.patientBirthDate && target.birthDate && item.patientBirthDate !== target.birthDate) conflicts.push("date de naissance différente");
  }
  return { suggested, byNiss, conflicts };
}
