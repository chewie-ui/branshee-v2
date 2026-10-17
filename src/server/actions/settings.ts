"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, bookingSettings, businesses, notificationSettings } from "@/db/schema";
import { slugify } from "@/lib/slug";
import { requireContext } from "@/server/context";
import { RESERVED_SLUGS } from "@/server/business";

export type SettingsState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | undefined;

function fail(error: z.ZodError): SettingsState {
  const fieldErrors: Record<string, string> = {};
  for (const i of error.issues) fieldErrors[String(i.path[0])] ??= i.message;
  return { error: "Vérifiez les champs indiqués.", fieldErrors };
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const optionalUrl = z.union([z.literal(""), z.url({ message: "Adresse web invalide (commencez par https://)." })]);

const businessSchema = z.object({
  name: z.string().min(2, "Indiquez le nom.").max(80),
  businessType: z.string().max(60),
  description: z.string().max(1000),
  email: z.union([z.literal(""), z.email({ message: "Email invalide." })]),
  phone: z.string().max(40),
  website: optionalUrl,
  address: z.string().max(120),
  postalCode: z.string().max(12),
  city: z.string().max(80),
  slug: z.string().min(3, "3 caractères minimum.").max(60).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lettres minuscules, chiffres et tirets uniquement."),
});

export async function saveBusinessInfo(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const ctx = await requireContext("business.manage");
  const parsed = businessSchema.safeParse({
    name: str(fd, "name"),
    businessType: str(fd, "businessType"),
    description: str(fd, "description"),
    email: str(fd, "email").toLowerCase(),
    phone: str(fd, "phone"),
    website: str(fd, "website"),
    address: str(fd, "address"),
    postalCode: str(fd, "postalCode"),
    city: str(fd, "city"),
    slug: slugify(str(fd, "slug")),
  });
  if (!parsed.success) return fail(parsed.error);
  const v = parsed.data;

  if (RESERVED_SLUGS.has(v.slug)) return { error: "Vérifiez les champs indiqués.", fieldErrors: { slug: "Cette adresse est réservée, choisissez-en une autre." } };
  const [taken] = await db.select({ id: businesses.id }).from(businesses).where(and(eq(businesses.slug, v.slug), ne(businesses.id, ctx.business.id)));
  if (taken) return { error: "Vérifiez les champs indiqués.", fieldErrors: { slug: "Cette adresse est déjà prise." } };

  await db
    .update(businesses)
    .set({
      name: v.name,
      businessType: v.businessType || null,
      description: v.description || null,
      email: v.email || null,
      phone: v.phone || null,
      website: v.website || null,
      address: v.address || null,
      postalCode: v.postalCode || null,
      city: v.city || null,
      slug: v.slug,
    })
    .where(eq(businesses.id, ctx.business.id));
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "settings.business", description: "Infos de l'établissement modifiées" });
  revalidatePath("/app", "layout");
  return { ok: true };
}

const nullableInt = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === "none" || v == null ? null : Number(v)), z.number().int().min(min).max(max).nullable());

const rulesSchema = z.object({
  slotMode: z.enum(["fixed", "interval"]),
  slotIntervalMin: z.coerce.number().int().min(5).max(240),
  bufferBeforeMin: z.coerce.number().int().min(0).max(240),
  bufferAfterMin: z.coerce.number().int().min(0).max(240),
  minLeadMin: nullableInt(0, 60 * 24 * 14),
  horizonDays: nullableInt(1, 730),
  autoConfirm: z.boolean(),
  phoneRequired: z.boolean(),
  fvEnabled: z.boolean(),
  fvQuestion: z.string().trim().min(3, "Question trop courte.").max(140),
  fvNew: z.string().trim().min(1).max(60),
  fvExisting: z.string().trim().min(1).max(60),
  waitlistEnabled: z.boolean(),
  allowOverbooking: z.boolean(),
  sgEnabled: z.boolean(),
  sgWindow: z.coerce.number().int().min(1).max(6),
  sgWeekdays: z.array(z.number().int().min(0).max(6)),
});

export async function saveBookingRules(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const ctx = await requireContext("settings.manage");
  const parsed = rulesSchema.safeParse({
    slotMode: str(fd, "slotMode"),
    slotIntervalMin: str(fd, "slotIntervalMin"),
    bufferBeforeMin: str(fd, "bufferBeforeMin"),
    bufferAfterMin: str(fd, "bufferAfterMin"),
    // Délai personnalisé saisi en heures (« 3,5 » → 210 min).
    minLeadMin: fd.has("minLeadHours") ? String(Math.round(Number(str(fd, "minLeadHours").replace(",", ".")) * 60)) : str(fd, "minLeadMin"),
    horizonDays: str(fd, "horizonDays"),
    autoConfirm: fd.get("autoConfirm") === "on",
    phoneRequired: fd.get("phoneRequired") === "on",
    fvEnabled: fd.get("fvEnabled") === "on",
    fvQuestion: str(fd, "fvQuestion"),
    fvNew: str(fd, "fvNew"),
    fvExisting: str(fd, "fvExisting"),
    waitlistEnabled: fd.get("waitlistEnabled") === "on",
    allowOverbooking: fd.get("allowOverbooking") === "on",
    sgEnabled: fd.get("sgEnabled") === "on",
    sgWindow: str(fd, "sgWindow") || "3",
    sgWeekdays: str(fd, "sgWeekdays").split(",").filter(Boolean).map(Number),
  });
  if (!parsed.success) return fail(parsed.error);
  const v = parsed.data;
  await db
    .update(bookingSettings)
    .set({
      slotMode: v.slotMode,
      slotIntervalMin: v.slotIntervalMin,
      bufferBeforeMin: v.bufferBeforeMin,
      bufferAfterMin: v.bufferAfterMin,
      minLeadMin: v.minLeadMin,
      horizonDays: v.horizonDays,
      autoConfirm: v.autoConfirm,
      phoneRequired: v.phoneRequired,
      firstVisitQuestion: { enabled: v.fvEnabled, question: v.fvQuestion, newLabel: v.fvNew, existingLabel: v.fvExisting },
      waitlistEnabled: v.waitlistEnabled,
      allowOverbooking: v.allowOverbooking,
      smartGrouping: { enabled: v.sgEnabled, windowHours: v.sgWindow, weekdays: v.sgWeekdays },
    })
    .where(eq(bookingSettings.businessId, ctx.business.id));
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "settings.booking", description: "Règles de réservation modifiées" });
  revalidatePath("/app/reglages/reservation");
  return { ok: true };
}

const notifSchema = z.object({
  reminderDelayHours: z.coerce.number().refine((n) => [0, 6, 12, 24, 48, 72].includes(n), "Délai invalide."),
  confirmationMessage: z.string().trim().max(500),
  reminderMessage: z.string().trim().max(500),
  cancellationMessage: z.string().trim().max(500),
  emailOwnerOnNewBooking: z.boolean(),
  emailOwnerOnCancellation: z.boolean(),
});

export async function saveNotifications(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const ctx = await requireContext("settings.manage");
  const parsed = notifSchema.safeParse({
    reminderDelayHours: str(fd, "reminderDelayHours"),
    confirmationMessage: str(fd, "confirmationMessage"),
    reminderMessage: str(fd, "reminderMessage"),
    cancellationMessage: str(fd, "cancellationMessage"),
    emailOwnerOnNewBooking: fd.get("emailOwnerOnNewBooking") === "on",
    emailOwnerOnCancellation: fd.get("emailOwnerOnCancellation") === "on",
  });
  if (!parsed.success) return fail(parsed.error);
  const v = parsed.data;
  await db
    .update(notificationSettings)
    .set({
      reminderDelayHours: v.reminderDelayHours,
      confirmationMessage: v.confirmationMessage || null,
      reminderMessage: v.reminderMessage || null,
      cancellationMessage: v.cancellationMessage || null,
      emailOwnerOnNewBooking: v.emailOwnerOnNewBooking,
      emailOwnerOnCancellation: v.emailOwnerOnCancellation,
    })
    .where(eq(notificationSettings.businessId, ctx.business.id));
  revalidatePath("/app/reglages/notifications");
  return { ok: true };
}
