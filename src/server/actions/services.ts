"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, count, eq, inArray, isNull, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, bookingPageSettings, members, serviceCategories, serviceHours, serviceMembers, services } from "@/db/schema";
import { weekError, weekSchema } from "@/lib/week-schema";
import { serviceLimitReached } from "@/server/plan";
import { requireContext } from "@/server/context";
import { deletePublicImage, savePublicImage } from "@/server/storage";

export type ServiceFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

/** "45" / "45,50" / "45.5" → centimes ; vide → null (prix non affiché). */
function parsePrice(raw: string): number | null | "invalid" {
  const v = raw.trim().replace(/\s|€/g, "").replace(",", ".");
  if (!v) return null;
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(v)) return "invalid";
  return Math.round(Number(v) * 100);
}

const COLOR = /^#[0-9a-f]{6}$/i;

const schema = z.object({
  name: z.string().trim().min(2, "Donnez un nom à la prestation.").max(80),
  description: z.string().trim().max(500),
  categoryId: z.string(),
  newCategory: z.string().trim().max(50),
  durationMin: z.coerce.number().int().min(5, "Durée minimum : 5 min.").max(720, "Durée maximum : 12 h."),
  price: z.string(),
  color: z.string().regex(COLOR, "Couleur invalide."),
  audience: z.enum(["all", "new", "existing"]),
  isActive: z.boolean(),
  memberIds: z.array(z.uuid()),
  kind: z.enum(["individual", "group"]),
  blocksIndividual: z.boolean(),
  capacity: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(2, "Au moins 2 places.").max(500).nullable()),
  /** Durée variable (« 30 à 45 min ») : borne haute, utilisée pour bloquer l'agenda. */
  durationMaxMin: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().max(720).nullable()),
  location: z.string().trim().max(200),
  feeEnabled: z.boolean(),
  feeType: z.enum(["percent", "amount"]),
  feeValue: z.string().trim().max(10),
});

export async function saveService(serviceId: string | null, _prev: ServiceFormState, formData: FormData): Promise<ServiceFormState> {
  const ctx = await requireContext("services.manage");
  const bid = ctx.business.id;

  const parsed = schema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    newCategory: String(formData.get("newCategory") ?? ""),
    durationMin: formData.get("durationMin"),
    price: String(formData.get("price") ?? ""),
    color: String(formData.get("color") ?? ""),
    audience: String(formData.get("audience") ?? "all"),
    isActive: formData.get("isActive") === "on",
    memberIds: formData.getAll("memberIds").map(String),
    kind: String(formData.get("kind") ?? "individual"),
    blocksIndividual: formData.get("blocksIndividual") === "on",
    capacity: formData.get("capacity"),
    durationMaxMin: formData.get("durationMaxMin"),
    location: String(formData.get("location") ?? ""),
    feeEnabled: formData.get("feeEnabled") === "on",
    feeType: String(formData.get("feeType") ?? "percent"),
    feeValue: String(formData.get("feeValue") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Vérifiez les champs indiqués.", fieldErrors };
  }
  const v = parsed.data;
  if (v.kind === "group" && !v.capacity) return { error: "Vérifiez les champs indiqués.", fieldErrors: { capacity: "Indiquez le nombre de places." } };
  let hoursRaw: unknown = {};
  try {
    hoursRaw = JSON.parse(String(formData.get("hours") ?? "{}"));
  } catch {
    /* champ absent ou illisible : aucune restriction */
  }
  const hours = weekSchema.safeParse(hoursRaw);
  if (!hours.success) return { error: "Vérifiez les champs indiqués.", fieldErrors: { hours: weekError(hours.error.issues) } };
  const hourRows = v.kind === "individual" ? Object.entries(hours.data).flatMap(([wd, ranges]) => ranges.map((r) => ({ weekday: Number(wd), startTime: r.start, endTime: r.end }))) : [];
  if (formData.get("hoursMode") !== null && hourRows.length === 0 && String(formData.get("hours")) !== "{}") return { error: "Vérifiez les champs indiqués.", fieldErrors: { hours: "Activez au moins un jour." } };
  if (v.durationMaxMin != null && v.durationMaxMin <= v.durationMin) return { error: "Vérifiez les champs indiqués.", fieldErrors: { durationMaxMin: "La durée maximale doit dépasser la durée minimale." } };
  let feeValue: number | null = null;
  if (v.feeEnabled) {
    const raw = v.feeValue.replace(/\s|€|%/g, "").replace(",", ".");
    const n = Number(raw);
    if (!raw || Number.isNaN(n) || n <= 0 || (v.feeType === "percent" && n > 100)) return { error: "Vérifiez les champs indiqués.", fieldErrors: { feeValue: v.feeType === "percent" ? "Entre 1 et 100 %." : "Montant invalide." } };
    feeValue = v.feeType === "percent" ? Math.round(n) : Math.round(n * 100);
  }

  // Image : envoi d'une nouvelle, ou suppression de l'actuelle.
  const imageFile = formData.get("image");
  let newImage: string | null = null;
  if (imageFile instanceof File && imageFile.size > 0) {
    if (imageFile.size > 5 * 1024 * 1024) return { error: "Vérifiez les champs indiqués.", fieldErrors: { image: "Image trop lourde (5 Mo maximum)." } };
    try {
      newImage = await savePublicImage(Buffer.from(await imageFile.arrayBuffer()));
    } catch (e) {
      return { error: "Vérifiez les champs indiqués.", fieldErrors: { image: e instanceof Error ? e.message : "Image invalide." } };
    }
  }
  const removeImage = formData.get("removeImage") === "1";
  const priceCents = parsePrice(v.price);
  if (priceCents === "invalid") return { error: "Vérifiez les champs indiqués.", fieldErrors: { price: "Prix invalide (ex. 45 ou 45,50)." } };

  let previousImage: string | null = null;
  let wasActive = false;
  if (serviceId) {
    const [existing] = await db.select({ id: services.id, imageUrl: services.imageUrl, isActive: services.isActive }).from(services).where(and(eq(services.id, serviceId), eq(services.businessId, bid)));
    if (!existing) return { error: "Prestation introuvable." };
    previousImage = existing.imageUrl;
    wasActive = existing.isActive;
  }
  // Forfait : nombre de prestations actives.
  if (v.isActive && !wasActive) {
    const [{ n }] = await db.select({ n: count() }).from(services).where(and(eq(services.businessId, bid), eq(services.isActive, true)));
    const lim = await serviceLimitReached(bid, n);
    if (lim.reached) return { error: `Votre forfait permet ${lim.max} prestations actives. Masquez-en une ou passez au forfait Pro (Réglages › Abonnement).` };
  }

  // Les membres choisis doivent appartenir à l'établissement.
  const validMembers = v.memberIds.length
    ? (await db.select({ id: members.id }).from(members).where(and(eq(members.businessId, bid), inArray(members.id, v.memberIds)))).map((m) => m.id)
    : [];

  const savedId = await db.transaction(async (tx) => {
    let categoryId: string | null = null;
    if (v.categoryId === "__new" && v.newCategory) {
      const [{ pos } = { pos: 0 }] = await tx.select({ pos: max(serviceCategories.position) }).from(serviceCategories).where(eq(serviceCategories.businessId, bid));
      const [cat] = await tx
        .insert(serviceCategories)
        .values({ businessId: bid, name: v.newCategory, position: (pos ?? 0) + 1 })
        .onConflictDoUpdate({ target: [serviceCategories.businessId, serviceCategories.name], set: { name: v.newCategory } })
        .returning({ id: serviceCategories.id });
      categoryId = cat!.id;
    } else if (v.categoryId) {
      const [cat] = await tx.select({ id: serviceCategories.id }).from(serviceCategories).where(and(eq(serviceCategories.id, v.categoryId), eq(serviceCategories.businessId, bid)));
      categoryId = cat?.id ?? null;
    }

    const values = { name: v.name, description: v.description || null, categoryId, durationMin: v.durationMin, priceCents, color: v.color, audience: v.audience, isActive: v.isActive, kind: v.kind, capacity: v.kind === "group" ? v.capacity : null, blocksIndividual: v.kind === "group" ? v.blocksIndividual : true,
      durationMaxMin: v.durationMaxMin,
      location: v.location || null,
      cancellationFeeType: v.feeEnabled ? v.feeType : null,
      cancellationFeeValue: feeValue,
      ...(newImage ? { imageUrl: newImage } : removeImage ? { imageUrl: null } : {}),
    };
    let id = serviceId;
    if (id) {
      await tx.update(services).set(values).where(eq(services.id, id));
    } else {
      const [{ pos } = { pos: 0 }] = await tx.select({ pos: max(services.position) }).from(services).where(eq(services.businessId, bid));
      const [created] = await tx.insert(services).values({ ...values, businessId: bid, position: (pos ?? 0) + 1 }).returning({ id: services.id });
      id = created!.id;
    }
    await tx.delete(serviceHours).where(eq(serviceHours.serviceId, id));
    if (hourRows.length) await tx.insert(serviceHours).values(hourRows.map((h) => ({ ...h, serviceId: id! })));
    await tx.delete(serviceMembers).where(eq(serviceMembers.serviceId, id));
    if (validMembers.length) await tx.insert(serviceMembers).values(validMembers.map((memberId) => ({ serviceId: id!, memberId })));
    await tx.insert(activityLogs).values({ businessId: bid, userId: ctx.user.id, actorName: ctx.user.name, action: serviceId ? "service.update" : "service.create", description: `Prestation ${serviceId ? "modifiée" : "créée"} : ${v.name}` });
    return id;
  });

  if (newImage || removeImage) await deletePublicImage(previousImage);
  revalidatePath("/app/prestations");
  // Nouveau cours collectif : on enchaîne directement sur la planification des séances.
  redirect(!serviceId && v.kind === "group" ? `/app/prestations/${savedId}#seances` : "/app/prestations");
}

export async function deleteService(serviceId: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireContext("services.manage");
  const id = z.uuid().parse(serviceId);
  // Les RDV passés gardent le nom de la prestation (copie figée), la suppression ne casse pas l'historique.
  const deleted = await db.delete(services).where(and(eq(services.id, id), eq(services.businessId, ctx.business.id))).returning({ name: services.name });
  if (!deleted.length) return { ok: false, error: "Prestation introuvable." };
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "service.delete", description: `Prestation supprimée : ${deleted[0]!.name}` });
  revalidatePath("/app/prestations");
  redirect("/app/prestations");
}

export async function toggleService(serviceId: string, active: boolean): Promise<void> {
  const ctx = await requireContext("services.manage");
  if (active) {
    const [{ n }] = await db.select({ n: count() }).from(services).where(and(eq(services.businessId, ctx.business.id), eq(services.isActive, true)));
    if ((await serviceLimitReached(ctx.business.id, n)).reached) return;
  }
  await db.update(services).set({ isActive: active }).where(and(eq(services.id, z.uuid().parse(serviceId)), eq(services.businessId, ctx.business.id)));
  revalidatePath("/app/prestations");
}

/* ───────────────────────────── Liste : activation, ordre ───────────────────────────── */

/** Active / masque une ou plusieurs prestations en un clic. */
export async function setServicesActive(rawIds: string[], active: boolean): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireContext("services.manage");
  const ids = z.array(z.uuid()).min(1).max(500).parse(rawIds);
  if (active) {
    const rows = await db.select({ id: services.id, isActive: services.isActive }).from(services).where(eq(services.businessId, ctx.business.id));
    const willBe = rows.filter((r) => r.isActive || ids.includes(r.id)).length;
    const lim = await serviceLimitReached(ctx.business.id, willBe - 1);
    if (lim.reached) return { ok: false, error: `Votre forfait permet ${lim.max} prestations actives. Passez au forfait Pro pour en proposer plus.` };
  }
  const updated = await db.update(services).set({ isActive: active }).where(and(eq(services.businessId, ctx.business.id), inArray(services.id, ids))).returning({ name: services.name });
  if (updated.length) await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: active ? "service.activate" : "service.deactivate", description: updated.length === 1 ? `Prestation ${active ? "activée" : "masquée"} : ${updated[0]!.name}` : `${updated.length} prestations ${active ? "activées" : "masquées"}` });
  revalidatePath("/app/prestations");
  return { ok: true };
}

/** Monte ou descend une prestation dans sa catégorie (ordre d'affichage public). */
export async function moveService(serviceId: string, direction: "up" | "down"): Promise<{ ok: boolean }> {
  const ctx = await requireContext("services.manage");
  const id = z.uuid().parse(serviceId);
  const [svc] = await db.select({ categoryId: services.categoryId }).from(services).where(and(eq(services.id, id), eq(services.businessId, ctx.business.id)));
  if (!svc) return { ok: false };
  const list = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.businessId, ctx.business.id), svc.categoryId ? eq(services.categoryId, svc.categoryId) : isNull(services.categoryId)))
    .orderBy(asc(services.position), asc(services.name));
  const i = list.findIndex((s) => s.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: false };
  [list[i], list[j]] = [list[j]!, list[i]!];
  await db.transaction(async (tx) => {
    for (const [position, s] of list.entries()) await tx.update(services).set({ position }).where(eq(services.id, s.id));
  });
  revalidatePath("/app/prestations");
  return { ok: true };
}

/* ───────────────────────────── Catégories ───────────────────────────── */

const categorySchema = z.object({ name: z.string().trim().min(1, "Donnez un nom à la catégorie.").max(50), icon: z.string().trim().max(8) });

export async function saveCategory(categoryId: string | null, input: { name: string; icon: string }): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireContext("services.manage");
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const v = parsed.data;
  try {
    if (categoryId) {
      const updated = await db.update(serviceCategories).set({ name: v.name, icon: v.icon || null }).where(and(eq(serviceCategories.id, z.uuid().parse(categoryId)), eq(serviceCategories.businessId, ctx.business.id))).returning({ id: serviceCategories.id });
      if (!updated.length) return { ok: false, error: "Catégorie introuvable." };
    } else {
      const [{ pos } = { pos: 0 }] = await db.select({ pos: max(serviceCategories.position) }).from(serviceCategories).where(eq(serviceCategories.businessId, ctx.business.id));
      await db.insert(serviceCategories).values({ businessId: ctx.business.id, name: v.name, icon: v.icon || null, position: (pos ?? 0) + 1 });
    }
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } };
    if (err.code === "23505" || err.cause?.code === "23505") return { ok: false, error: "Une catégorie porte déjà ce nom." };
    throw e;
  }
  revalidatePath("/app/prestations", "layout");
  return { ok: true };
}

/** Supprime une catégorie ; ses prestations passent « sans catégorie ». */
export async function deleteCategory(categoryId: string): Promise<{ ok: boolean }> {
  const ctx = await requireContext("services.manage");
  await db.delete(serviceCategories).where(and(eq(serviceCategories.id, z.uuid().parse(categoryId)), eq(serviceCategories.businessId, ctx.business.id)));
  revalidatePath("/app/prestations", "layout");
  return { ok: true };
}

export async function moveCategory(categoryId: string, direction: "up" | "down"): Promise<{ ok: boolean }> {
  const ctx = await requireContext("services.manage");
  const list = await db.select({ id: serviceCategories.id }).from(serviceCategories).where(eq(serviceCategories.businessId, ctx.business.id)).orderBy(asc(serviceCategories.position), asc(serviceCategories.name));
  const i = list.findIndex((c) => c.id === categoryId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: false };
  [list[i], list[j]] = [list[j]!, list[i]!];
  await db.transaction(async (tx) => {
    for (const [position, c] of list.entries()) await tx.update(serviceCategories).set({ position }).where(eq(serviceCategories.id, c.id));
  });
  revalidatePath("/app/prestations", "layout");
  return { ok: true };
}

/** Présentation des catégories sur la page de réservation : pastilles, accordéon ou grille. */
export async function setCategoryStyle(style: "pills" | "accordion" | "grid"): Promise<{ ok: boolean }> {
  const ctx = await requireContext("services.manage");
  const v = z.enum(["pills", "accordion", "grid"]).parse(style);
  await db.insert(bookingPageSettings).values({ businessId: ctx.business.id, categoryStyle: v }).onConflictDoUpdate({ target: bookingPageSettings.businessId, set: { categoryStyle: v } });
  revalidatePath("/app/prestations", "layout");
  return { ok: true };
}
