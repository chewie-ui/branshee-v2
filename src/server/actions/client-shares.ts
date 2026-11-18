"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { activityLogs, clientShares, customers } from "@/db/schema";
import { encrypt } from "@/lib/field-crypto";
import { requireContext, type AppContext } from "@/server/context";
import { deletePrivateFile, savePrivateFile } from "@/server/storage";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";

type Result = { ok: true; message: string } | { ok: false; error: string };

const MAX_BYTES = 10 * 1024 * 1024;
const appUrl = () => (process.env.APP_URL ?? "https://skydev.be").replace(/\/$/, "");

async function ownCustomer(ctx: AppContext, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [c] = await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.businessId, ctx.business.id)));
  return c ?? null;
}

async function after(ctx: AppContext, c: typeof customers.$inferSelect, what: string, notify: boolean) {
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "customer.share", description: `${what} partagé avec ${c.fullName}` });
  // Email sans le contenu (données potentiellement de santé) : juste un lien vers l'espace client.
  if (notify && c.email) await sendEmail({ to: c.email, ...emails.clientShare({ businessName: ctx.business.name, name: c.fullName.split(" ")[0] ?? null, url: `${appUrl()}/espace-client/documents` }), template: "client_share", businessId: ctx.business.id }).catch(() => false);
  revalidatePath(`/app/clients/${c.id}`);
}

const noteSchema = z.object({ title: z.string().trim().max(120).default(""), body: z.string().trim().min(1, "Écrivez votre note.").max(5000), notify: z.boolean().default(false) });

/** Note visible par le client dans son espace (chiffrée en base). */
export async function shareNote(customerId: string, input: unknown): Promise<Result> {
  const ctx = await requireContext("customers.manage", { app: "clients" });
  if (ctx.impersonating) return { ok: false, error: "Mode supervision : lecture seule." };
  const c = await ownCustomer(ctx, customerId);
  if (!c) return { ok: false, error: "Fiche introuvable." };
  const v = noteSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Note invalide." };
  await db.insert(clientShares).values({ businessId: ctx.business.id, customerId: c.id, kind: "note", title: v.data.title, bodyEnc: encrypt(v.data.body), authorName: ctx.user.name });
  await after(ctx, c, "Note", v.data.notify);
  return { ok: true, message: c.userId ? "Note partagée : visible dans son espace client." : "Note partagée. Elle sera visible dès que le client aura créé son compte avec son email." };
}

/** Fichier (PDF, image, vidéo…) téléchargeable par le client depuis son espace (chiffré sur le disque). */
export async function shareFile(customerId: string, fd: FormData): Promise<Result> {
  const ctx = await requireContext("customers.manage", { app: "clients" });
  if (ctx.impersonating) return { ok: false, error: "Mode supervision : lecture seule." };
  const c = await ownCustomer(ctx, customerId);
  if (!c) return { ok: false, error: "Fiche introuvable." };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choisissez un fichier." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Fichier trop lourd (10 Mo maximum)." };
  const name = file.name.replace(/[\\/\0]/g, "_").slice(0, 150) || "document";
  const title = String(fd.get("title") ?? "").trim().slice(0, 120);
  const ref = await savePrivateFile(Buffer.from(await file.arrayBuffer()));
  await db.insert(clientShares).values({ businessId: ctx.business.id, customerId: c.id, kind: "file", title, fileRef: ref, fileName: name, mime: (file.type || "application/octet-stream").slice(0, 100), sizeBytes: file.size, authorName: ctx.user.name });
  await after(ctx, c, "Fichier", fd.get("notify") === "on");
  return { ok: true, message: c.userId ? "Fichier partagé : disponible dans son espace client." : "Fichier partagé. Il sera visible dès que le client aura créé son compte avec son email." };
}

export async function deleteShare(id: string): Promise<Result> {
  const ctx = await requireContext("customers.manage", { app: "clients" });
  if (ctx.impersonating) return { ok: false, error: "Mode supervision : lecture seule." };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Introuvable." };
  const [s] = await db.delete(clientShares).where(and(eq(clientShares.id, id), eq(clientShares.businessId, ctx.business.id))).returning();
  if (!s) return { ok: false, error: "Introuvable." };
  await deletePrivateFile(s.fileRef).catch(() => {});
  revalidatePath(`/app/clients/${s.customerId}`);
  return { ok: true, message: "Retiré de son espace client." };
}
