"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, bookingPageSettings, businesses, formQuestions, type PageSection } from "@/db/schema";
import { resolveTheme, themeSchema } from "@/lib/booking-theme";
import { slugify } from "@/lib/slug";
import { RESERVED_SLUGS } from "@/server/business";
import { requireContext } from "@/server/context";
import { richTextToPlain, sanitizeRichText } from "@/server/rich-text";
import { deletePublicImage, savePublicImage } from "@/server/storage";

type Result = { ok: true } | { ok: false; error: string };

const questionSchema = z.object({
  label: z.string().trim().min(2, "Chaque question doit avoir un intitulé.").max(200),
  type: z.enum(["text", "choice", "yes_no"]),
  isRequired: z.boolean(),
  options: z.array(z.string().trim().min(1).max(80)).max(12),
});

/** Remplace l'ensemble des questions posées avant la réservation (ordre = ordre de la liste). */
export async function saveFormQuestions(input: unknown): Promise<Result> {
  const ctx = await requireContext("forms.manage");
  const parsed = z.array(questionSchema).max(10, "10 questions maximum.").safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  for (const q of parsed.data) if (q.type === "choice" && q.options.length < 2) return { ok: false, error: `« ${q.label} » : ajoutez au moins deux choix.` };
  await db.transaction(async (tx) => {
    await tx.delete(formQuestions).where(eq(formQuestions.businessId, ctx.business.id));
    if (parsed.data.length) {
      await tx.insert(formQuestions).values(parsed.data.map((q, i) => ({ businessId: ctx.business.id, label: q.label, type: q.type, isRequired: q.isRequired, options: q.type === "choice" ? q.options : [], position: i })));
    }
    await tx.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "form.update", description: "Questions de réservation modifiées" });
  });
  revalidatePath("/app/page-de-reservation");
  return { ok: true };
}

const faqSchema = z
  .array(z.object({ question: z.string().trim().min(2, "Chaque question fréquente doit avoir une question et une réponse.").max(200), answer: z.string().trim().min(1, "Chaque question fréquente doit avoir une question et une réponse.").max(1500) }))
  .max(20, "20 questions fréquentes maximum.");

function done(ctx: { business: { id: string }; user: { id: string; name: string } }, description: string) {
  revalidatePath("/app/page-de-reservation", "layout");
  return db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "booking_page.update", description });
}

export async function saveFaq(input: unknown): Promise<Result> {
  const ctx = await requireContext("customization.manage");
  const parsed = faqSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  await db.update(bookingPageSettings).set({ faq: parsed.data }).where(eq(bookingPageSettings.businessId, ctx.business.id));
  await done(ctx, "Questions fréquentes modifiées");
  return { ok: true };
}

/** Photo / logo et texte « À propos » (texte riche nettoyé). */
export async function saveProfile(fd: FormData): Promise<Result> {
  const ctx = await requireContext("customization.manage");
  const about = sanitizeRichText(String(fd.get("aboutHtml") ?? "").slice(0, 20000));
  if (richTextToPlain(about).length > 3000) return { ok: false, error: "Le texte « À propos » est trop long (3 000 caractères maximum)." };
  const file = fd.get("photo");
  let photo: string | null | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) return { ok: false, error: "Image trop lourde (5 Mo maximum)." };
    try {
      photo = await savePublicImage(Buffer.from(await file.arrayBuffer()));
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Image invalide." };
    }
  } else if (fd.get("removePhoto") === "1") photo = null;
  const [before] = await db.select({ photoUrl: businesses.photoUrl }).from(businesses).where(eq(businesses.id, ctx.business.id));
  await db
    .update(businesses)
    .set({ aboutHtml: about || null, ...(photo !== undefined ? { photoUrl: photo } : {}) })
    .where(eq(businesses.id, ctx.business.id));
  if (photo !== undefined) await deletePublicImage(before?.photoUrl);
  await done(ctx, "Profil de la page modifié");
  return { ok: true };
}

/** Extrait l'URL d'une carte Google Maps depuis le code « Intégrer une carte » (ou l'URL seule). */
function mapEmbedSrc(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const src = raw.match(/src\s*=\s*["']([^"']+)["']/i)?.[1] ?? raw;
  try {
    const u = new URL(src.replace(/&amp;/g, "&"));
    if (u.protocol !== "https:" || !/^(www\.)?google\.[a-z.]+$/.test(u.hostname) || !u.pathname.startsWith("/maps/embed")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

const locationSchema = z.object({
  mode: z.enum(["on_site", "online", "embed"]),
  address: z.string().trim().max(120),
  postalCode: z.string().trim().max(12),
  city: z.string().trim().max(80),
  country: z.string().trim().max(60),
  mapsUrl: z.union([z.literal(""), z.url({ protocol: /^https$/, message: "Le lien Maps doit commencer par https://" })]),
  mapEmbed: z.string().max(3000),
  languages: z.array(z.string().regex(/^[a-z]{2}$/)).max(12),
});

export async function saveLocation(input: unknown): Promise<Result> {
  const ctx = await requireContext("customization.manage");
  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const v = parsed.data;
  const embed = mapEmbedSrc(v.mapEmbed);
  if (v.mapEmbed.trim() && !embed) return { ok: false, error: "Code de carte non reconnu : sur Google Maps, choisissez « Partager » → « Intégrer une carte » et copiez le code." };
  await db
    .update(businesses)
    .set({ locationMode: v.mode, address: v.address || null, postalCode: v.postalCode || null, city: v.city || null, country: v.country || null, mapsUrl: v.mapsUrl || null, mapEmbedUrl: embed, languages: v.languages })
    .where(eq(businesses.id, ctx.business.id));
  await done(ctx, "Localisation modifiée");
  return { ok: true };
}

const GALLERY_MAX = 12;

export async function addGalleryImages(fd: FormData): Promise<Result> {
  const ctx = await requireContext("customization.manage");
  const files = fd.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, error: "Choisissez au moins une image." };
  const [page] = await db.select({ gallery: bookingPageSettings.gallery }).from(bookingPageSettings).where(eq(bookingPageSettings.businessId, ctx.business.id));
  const current = page?.gallery ?? [];
  if (current.length + files.length > GALLERY_MAX) return { ok: false, error: `${GALLERY_MAX} photos maximum (il reste ${GALLERY_MAX - current.length} place${GALLERY_MAX - current.length > 1 ? "s" : ""}).` };
  const added: string[] = [];
  for (const f of files) {
    if (f.size > 5 * 1024 * 1024) return { ok: false, error: `« ${f.name} » est trop lourde (5 Mo maximum).` };
    try {
      added.push(await savePublicImage(Buffer.from(await f.arrayBuffer())));
    } catch (e) {
      for (const u of added) await deletePublicImage(u);
      return { ok: false, error: `« ${f.name} » : ${e instanceof Error ? e.message : "image invalide"}` };
    }
  }
  await db.update(bookingPageSettings).set({ gallery: [...current, ...added] }).where(eq(bookingPageSettings.businessId, ctx.business.id));
  await done(ctx, `${added.length} photo${added.length > 1 ? "s" : ""} ajoutée${added.length > 1 ? "s" : ""} à la galerie`);
  return { ok: true };
}

/** Nouvel ordre / suppression / présentation de la galerie (la liste ne peut que contenir des photos existantes). */
export async function saveGallery(input: { images: string[]; layout: "grid" | "mosaic" | "carousel" }): Promise<Result> {
  const ctx = await requireContext("customization.manage");
  const layout = z.enum(["grid", "mosaic", "carousel"]).safeParse(input.layout);
  if (!layout.success || !Array.isArray(input.images)) return { ok: false, error: "Données invalides." };
  const [page] = await db.select({ gallery: bookingPageSettings.gallery }).from(bookingPageSettings).where(eq(bookingPageSettings.businessId, ctx.business.id));
  const current = page?.gallery ?? [];
  const next = [...new Set(input.images)].filter((u) => current.includes(u));
  await db.update(bookingPageSettings).set({ gallery: next, galleryLayout: layout.data }).where(eq(bookingPageSettings.businessId, ctx.business.id));
  for (const u of current.filter((u) => !next.includes(u))) await deletePublicImage(u);
  await done(ctx, "Galerie modifiée");
  return { ok: true };
}

const SECTIONS: PageSection[] = ["about", "services", "team", "reviews", "amenities", "faq", "gallery", "location", "hours"];

/** Sections affichées, dans l'ordre choisi (celles absentes de la liste sont masquées). */
export async function saveSections(input: unknown): Promise<Result> {
  const ctx = await requireContext("customization.manage");
  const parsed = z.array(z.enum(SECTIONS as [PageSection, ...PageSection[]])).max(SECTIONS.length).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Sections invalides." };
  await db.update(bookingPageSettings).set({ sections: [...new Set(parsed.data)] }).where(eq(bookingPageSettings.businessId, ctx.business.id));
  await done(ctx, "Sections de la page modifiées");
  return { ok: true };
}

const handle = z.string().trim().max(200);
const socialSchema = z.object({
  website: z.union([z.literal(""), z.url({ protocol: /^https?$/, message: "Site web invalide (commencez par https://)." })]),
  instagram: handle,
  facebook: handle,
  whatsapp: handle,
  tiktok: handle,
  linkedin: handle,
  youtube: handle,
  show: z.object({ email: z.boolean(), phone: z.boolean(), instagram: z.boolean(), facebook: z.boolean(), whatsapp: z.boolean(), website: z.boolean() }),
});

export async function saveSocial(input: unknown): Promise<Result> {
  const ctx = await requireContext("customization.manage");
  const parsed = socialSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const { website, show, ...social } = parsed.data;
  const clean = Object.fromEntries(Object.entries(social).filter(([, v]) => v));
  await db.transaction(async (tx) => {
    await tx.update(businesses).set({ website: website || null, social: clean }).where(eq(businesses.id, ctx.business.id));
    await tx.update(bookingPageSettings).set({ showContact: show }).where(eq(bookingPageSettings.businessId, ctx.business.id));
  });
  await done(ctx, "Réseaux sociaux modifiés");
  return { ok: true };
}

export async function saveTheme(input: unknown): Promise<Result> {
  const ctx = await requireContext("customization.manage");
  const parsed = themeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const t = parsed.data;
  if (!!t.customFontUrl !== !!t.customFontFamily) return { ok: false, error: "Pour une police importée, indiquez à la fois son adresse et son nom." };
  // On ne stocke que les champs renseignés : les vides retombent sur « automatique ».
  const theme = Object.fromEntries(Object.entries(t).filter(([, v]) => v !== "" && v !== undefined)) as typeof t;
  await db.update(bookingPageSettings).set({ theme: resolveTheme(theme) }).where(eq(bookingPageSettings.businessId, ctx.business.id));
  await done(ctx, "Apparence de la page modifiée");
  return { ok: true };
}

export async function saveSlug(input: string): Promise<Result & { slug?: string }> {
  const ctx = await requireContext("customization.manage");
  const slug = slugify(String(input ?? ""));
  if (slug.length < 3) return { ok: false, error: "3 caractères minimum (lettres, chiffres, tirets)." };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, error: "Cette adresse est réservée, choisissez-en une autre." };
  const [taken] = await db.select({ id: businesses.id }).from(businesses).where(and(eq(businesses.slug, slug), ne(businesses.id, ctx.business.id)));
  if (taken) return { ok: false, error: "Cette adresse est déjà prise." };
  await db.update(businesses).set({ slug }).where(eq(businesses.id, ctx.business.id));
  await done(ctx, `Adresse de la page changée en « ${slug} »`);
  revalidatePath("/app", "layout");
  return { ok: true, slug };
}

const embedSchema = z.object({
  title: z.string().trim().max(80),
  fontUrl: z.string().trim().max(500).refine((u) => u === "" || /^https:\/\/[^\s"'<>()]+$/.test(u), "L'adresse de la police doit commencer par https://"),
  fontFamily: z.string().trim().max(60).regex(/^[\p{L}\p{N} _-]*$/u, "Nom de police invalide."),
});

/** Réglages du calendrier intégré sur le site du pro (titre, police). */
export async function saveEmbed(input: unknown): Promise<Result> {
  const ctx = await requireContext("customization.manage");
  const parsed = embedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const v = parsed.data;
  await db
    .update(bookingPageSettings)
    .set({ embed: { title: v.title || undefined, fontUrl: v.fontUrl || undefined, fontFamily: v.fontFamily || undefined } })
    .where(eq(bookingPageSettings.businessId, ctx.business.id));
  await done(ctx, "Intégration modifiée");
  return { ok: true };
}

/** Image de fond de la page (enregistrée tout de suite ; le thème la référence ensuite). */
export async function uploadPageBackground(fd: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireContext("customization.manage");
  const f = fd.get("image");
  if (!(f instanceof File) || f.size === 0) return { ok: false, error: "Choisissez une image." };
  if (f.size > 5 * 1024 * 1024) return { ok: false, error: "Image trop lourde (5 Mo maximum)." };
  try {
    return { ok: true, url: await savePublicImage(Buffer.from(await f.arrayBuffer())) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Image invalide." };
  }
}
