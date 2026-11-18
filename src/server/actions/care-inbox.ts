"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { careInbox, customerNotes, customers } from "@/db/schema";
import { blindIndex, decrypt, encrypt } from "@/lib/field-crypto";
import { parseKmehr } from "@/lib/kmehr";
import { normalizeNiss, nissFacts, validNiss } from "@/lib/niss";
import { todayIso } from "@/lib/invoicing";
import { requireContext, type AppContext } from "@/server/context";
import { isPdf, savePrivateFile } from "@/server/storage";
import { logRecordAccess } from "@/server/physio";
import { inboxMatch } from "@/server/care-inbox";

type Result = { ok: true; message: string } | { ok: false; error: string };
const RO = { ok: false as const, error: "Mode supervision : lecture seule." };
const MAX = 10 * 1024 * 1024;

/** Dépose des documents reçus (PDF, messages Kmehr XML) dans la boîte de réception. */
export async function uploadToInbox(fd: FormData): Promise<Result> {
  const ctx = await requireContext("records.manage", { app: "clients" });
  if (ctx.impersonating) return RO;
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 20);
  if (!files.length) return { ok: false, error: "Choisissez au moins un fichier." };
  let added = 0;
  const refused: string[] = [];
  for (const f of files) {
    if (f.size > MAX) {
      refused.push(`${f.name} (plus de 10 Mo)`);
      continue;
    }
    const data = Buffer.from(await f.arrayBuffer());
    const name = (f.name || "document").slice(0, 200);
    if (isPdf(data)) {
      await db.insert(careInbox).values({ businessId: ctx.business.id, source: "upload", messageType: "document", title: name.replace(/\.pdf$/i, ""), filePath: await savePrivateFile(data), fileName: name, fileSize: f.size });
      added++;
      continue;
    }
    const k = parseKmehr(data.toString("utf8"));
    if (!k) {
      refused.push(`${name} (ni PDF ni message Kmehr)`);
      continue;
    }
    const niss = k.patient.niss ? normalizeNiss(k.patient.niss) : null;
    const okNiss = niss && validNiss(niss) ? niss : null;
    await db.insert(careInbox).values({
      businessId: ctx.business.id,
      source: "kmehr",
      messageType: k.transactionType ?? "kmehr",
      title: k.transactionType ? `Message Kmehr : ${k.transactionType}` : name,
      senderName: k.sender.name,
      senderInami: k.sender.inami,
      docDate: k.date && /^\d{4}-\d{2}-\d{2}$/.test(k.date) ? k.date : null,
      patientName: [k.patient.firstName, k.patient.lastName].filter(Boolean).join(" ") || null,
      patientBirthDate: k.patient.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(k.patient.birthDate) ? k.patient.birthDate : okNiss ? nissFacts(okNiss).birthDate : null,
      patientNissEnc: okNiss ? encrypt(okNiss) : null,
      patientNissHash: okNiss ? blindIndex(okNiss, "niss") : null,
      contentEnc: encrypt(k.text),
      fileName: name,
      fileSize: f.size,
    });
    added++;
  }
  revalidatePath("/app/clients/reception");
  if (!added) return { ok: false, error: `Aucun document ajouté : ${refused.join(", ")}.` };
  return { ok: true, message: `${added} document${added > 1 ? "s" : ""} en attente d'intégration.${refused.length ? ` Refusé : ${refused.join(", ")}.` : ""}` };
}

async function pending(ctx: AppContext, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [r] = await db.select().from(careInbox).where(and(eq(careInbox.id, id), eq(careInbox.businessId, ctx.business.id), eq(careInbox.status, "pending")));
  return r ?? null;
}

async function integrate(ctx: AppContext, item: typeof careInbox.$inferSelect, customerId: string) {
  let content = "";
  try {
    content = decrypt(item.contentEnc) ?? "";
  } catch {
    content = "";
  }
  const from = [item.senderName, item.senderInami ? `INAMI ${item.senderInami}` : null].filter(Boolean).join(", ");
  await db.transaction(async (tx) => {
    await tx.insert(customerNotes).values({
      customerId,
      authorMemberId: ctx.member.id,
      date: item.docDate ?? todayIso(ctx.business.timezone),
      title: `Reçu : ${item.title}`.slice(0, 120),
      noteEnc: encrypt([from ? `Expéditeur : ${from}` : null, content].filter(Boolean).join("\n\n").slice(0, 10000)),
      todoEnc: encrypt(""),
      attachmentPath: item.filePath,
      attachmentName: item.filePath ? item.fileName : null,
      attachmentSize: item.filePath ? item.fileSize : null,
    });
    await tx.update(careInbox).set({ status: "integrated", customerId, handledByName: ctx.user.name, handledAt: new Date() }).where(eq(careInbox.id, item.id));
  });
  await logRecordAccess(ctx, customerId, "edit", `Document reçu intégré : ${item.title}`);
}

/**
 * Intègre un document reçu au dossier choisi. Un conflit d'identité (NISS d'un autre patient, nom différent)
 * bloque l'intégration tant qu'il n'est pas confirmé explicitement.
 */
export async function integrateInboxItem(id: string, customerId: string, confirmConflict = false): Promise<Result> {
  const ctx = await requireContext("records.manage", { app: "clients" });
  if (ctx.impersonating) return RO;
  const item = await pending(ctx, id);
  if (!item || !z.uuid().safeParse(customerId).success) return { ok: false, error: "Document ou patient introuvable." };
  const [c] = await db.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.businessId, ctx.business.id)));
  if (!c) return { ok: false, error: "Patient introuvable." };
  const m = await inboxMatch(ctx.business.id, item, c);
  if (m.conflicts.length && !confirmConflict) return { ok: false, error: `Conflit d'identité : ${m.conflicts.join(" ; ")}. Confirmez ou choisissez un autre patient.` };
  await integrate(ctx, item, c.id);
  revalidatePath("/app/clients/reception");
  revalidatePath(`/app/clients/${c.id}`);
  return { ok: true, message: `Intégré au dossier de ${c.fullName}.` };
}

/** Patient inconnu : crée la fiche à partir des données du message, puis intègre le document. */
export async function createPatientFromInbox(id: string): Promise<Result> {
  const ctx = await requireContext("records.manage", { app: "clients" });
  if (ctx.impersonating) return RO;
  const item = await pending(ctx, id);
  if (!item || !item.patientName) return { ok: false, error: "Ce document ne contient pas l'identité du patient : choisissez la fiche." };
  if (item.patientNissHash) {
    const [dup] = await db.select({ name: customers.fullName }).from(customers).where(and(eq(customers.businessId, ctx.business.id), eq(customers.nissHash, item.patientNissHash)));
    if (dup) return { ok: false, error: `Ce NISS existe déjà (fiche de ${dup.name}) : intégrez le document à cette fiche.` };
  }
  let niss: string | null = null;
  try {
    niss = item.patientNissEnc ? decrypt(item.patientNissEnc) : null;
  } catch {
    niss = null;
  }
  const parts = item.patientName.split(/\s+/);
  const [c] = await db
    .insert(customers)
    .values({ businessId: ctx.business.id, fullName: item.patientName, firstName: parts.length > 1 ? parts[0]! : null, lastName: parts.length > 1 ? parts.slice(1).join(" ") : item.patientName, birthDate: item.patientBirthDate, sex: niss ? nissFacts(niss).sex : null, nissEnc: item.patientNissEnc, nissHash: item.patientNissHash, createdManually: true })
    .returning();
  await integrate(ctx, item, c!.id);
  revalidatePath("/app/clients/reception");
  return { ok: true, message: `Fiche créée pour ${c!.fullName} et document intégré.` };
}

/** Intègre d'un coup tous les documents reconnus sans ambiguïté (même NISS, aucun conflit). */
export async function integrateMatchedInbox(): Promise<Result> {
  const ctx = await requireContext("records.manage", { app: "clients" });
  if (ctx.impersonating) return RO;
  const items = await db.select().from(careInbox).where(and(eq(careInbox.businessId, ctx.business.id), eq(careInbox.status, "pending")));
  let n = 0;
  for (const item of items) {
    const m = await inboxMatch(ctx.business.id, item);
    if (m.suggested && m.byNiss && !m.conflicts.length) {
      await integrate(ctx, item, m.suggested.id);
      n++;
    }
  }
  revalidatePath("/app/clients/reception");
  return n ? { ok: true, message: `${n} document${n > 1 ? "s" : ""} intégré${n > 1 ? "s" : ""}.` } : { ok: false, error: "Aucun document reconnu sans ambiguïté." };
}

export async function rejectInboxItems(ids: string[]): Promise<Result> {
  const ctx = await requireContext("records.manage", { app: "clients" });
  if (ctx.impersonating) return RO;
  const valid = ids.filter((i) => z.uuid().safeParse(i).success).slice(0, 100);
  if (!valid.length) return { ok: false, error: "Rien à refuser." };
  await db.update(careInbox).set({ status: "rejected", handledByName: ctx.user.name, handledAt: new Date() }).where(and(eq(careInbox.businessId, ctx.business.id), inArray(careInbox.id, valid), eq(careInbox.status, "pending")));
  revalidatePath("/app/clients/reception");
  return { ok: true, message: "Document écarté (conservé dans l'historique de la boîte)." };
}
