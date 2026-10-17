"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, members, serviceCategories, serviceHours, serviceMembers, services } from "@/db/schema";
import { weekError, weekSchema } from "@/lib/week-schema";
import { requireContext } from "@/server/context";

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
  const priceCents = parsePrice(v.price);
  if (priceCents === "invalid") return { error: "Vérifiez les champs indiqués.", fieldErrors: { price: "Prix invalide (ex. 45 ou 45,50)." } };

  if (serviceId) {
    const [existing] = await db.select({ id: services.id }).from(services).where(and(eq(services.id, serviceId), eq(services.businessId, bid)));
    if (!existing) return { error: "Prestation introuvable." };
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

    const values = { name: v.name, description: v.description || null, categoryId, durationMin: v.durationMin, priceCents, color: v.color, audience: v.audience, isActive: v.isActive, kind: v.kind, capacity: v.kind === "group" ? v.capacity : null, blocksIndividual: v.kind === "group" ? v.blocksIndividual : true };
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
  await db.update(services).set({ isActive: active }).where(and(eq(services.id, z.uuid().parse(serviceId)), eq(services.businessId, ctx.business.id)));
  revalidatePath("/app/prestations");
}
