"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { activityLogs, businesses, sites, users } from "@/db/schema";
import { SITE_TEMPLATES } from "@/lib/site-templates";
import { rateLimit } from "@/server/auth/rate-limit";
import { requireContext } from "@/server/context";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { businessHas } from "@/server/plan";
import { sanitizeArticleHtml } from "@/server/rich-text";
import { getOrCreateSite } from "@/server/site-builder";
import { savePublicImage } from "@/server/storage";
import { clientIp } from "@/lib/client-ip";

type Result = { ok: boolean; error?: string; message?: string };
const LOCKED: Result = { ok: false, error: "« Mon site » est inclus dans le forfait Pro+." };

async function ctxWithSite() {
  const ctx = await requireContext("customization.manage", { app: "site" });
  if (!(await businessHas(ctx.business.id, "mySite"))) return { ctx, site: null };
  return { ctx, site: await getOrCreateSite(ctx.business.id) };
}

const url = z.string().trim().max(600).refine((v) => !v || /^https:\/\//.test(v) || /^\/(media|uploads)\//.test(v), "Adresse d'image invalide.");
const str = (n: number) => z.string().trim().max(n).optional().default("");
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Données de chaque type de section : seuls les champs connus sont gardés, le HTML est nettoyé. */
const DATA = {
  hero: z.object({ title: str(160), subtitle: str(400), ctaText: str(60), bgImage: url.optional().default(""), textAlign: z.enum(["center", "left"]).optional().default("center"), overlayOpacity: z.coerce.number().min(0).max(85).optional().default(45), heroLayout: str(20) }),
  services: z.object({ title: str(160), subtitle: str(300) }),
  booking: z.object({ title: str(160), subtitle: str(300), embedMode: z.enum(["full", "compact"]).optional().default("full") }),
  about: z.object({ subtitle: str(80), title: str(160), text: z.string().max(20000).optional().default("").transform((v) => sanitizeArticleHtml(v)), image: url.optional().default(""), values: z.array(z.object({ title: str(80), desc: str(240) })).max(6).optional().default([]) }),
  gallery: z.object({ title: str(160), columns: z.enum(["2", "3", "4"]).optional().default("3"), images: z.array(z.object({ url, caption: str(120) })).max(24).optional().default([]) }),
  testimonials: z.object({ title: str(160), source: z.enum(["reviews", "manual"]).optional().default("reviews"), items: z.array(z.object({ name: str(80), rating: z.coerce.number().int().min(1).max(5).optional().default(5), text: str(600) })).max(12).optional().default([]) }),
  faq: z.object({ title: str(160), items: z.array(z.object({ question: str(240), answer: str(1500) })).max(20).optional().default([]) }),
  contact: z.object({ title: str(160), phone: str(40), email: str(160), address: str(240), showForm: z.boolean().optional().default(true) }),
  stats: z.object({ title: str(160), items: z.array(z.object({ number: str(20), label: str(80) })).max(6).optional().default([]) }),
  cta: z.object({ title: str(160), text: str(400), buttonText: str(60), buttonUrl: z.string().trim().max(300).refine((v) => !v || v.startsWith("#") || v.startsWith("/") || /^https:\/\//.test(v), "Lien du bouton invalide.").optional().default("#booking"), bg: str(20) }),
} as const;
type SectionType = keyof typeof DATA;

const sectionSchema = z.object({ id: z.string().regex(/^[a-z0-9-]{1,40}$/), type: z.enum(Object.keys(DATA) as [SectionType, ...SectionType[]]), enabled: z.boolean(), data: z.record(z.string(), z.unknown()) });

const saveSchema = z.object({
  sections: z.array(sectionSchema).max(20),
  theme: z.object({ primaryColor: color, bgColor: color, textColor: color, fontFamily: z.string().regex(/^[A-Za-z0-9 ]{2,40}$/), headingFont: z.string().regex(/^[A-Za-z0-9 ]{0,40}$/).optional(), roundness: z.enum(["sharp", "soft", "round"]) }),
  seo: z.object({ title: str(70), description: str(170) }),
  social: z.object({ instagram: str(200), facebook: str(200), tiktok: str(200), whatsapp: str(40), linkedin: str(200), youtube: str(200) }),
  logoUrl: url.optional().default(""),
  customDomain: z.string().trim().toLowerCase().max(120).refine((v) => !v || /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v), "Nom de domaine invalide (ex. www.moncabinet.be).").optional().default(""),
});

export async function saveSite(input: z.input<typeof saveSchema>): Promise<Result> {
  const { ctx, site } = await ctxWithSite();
  if (!site) return LOCKED;
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Contenu invalide." };
  const d = parsed.data;
  const ids = new Set<string>();
  const sections = [];
  for (const s of d.sections) {
    if (ids.has(s.id)) return { ok: false, error: "Deux sections ont le même identifiant." };
    ids.add(s.id);
    const data = DATA[s.type].safeParse(s.data);
    if (!data.success) return { ok: false, error: `Section « ${s.type} » : ${data.error.issues[0]?.message ?? "contenu invalide"}` };
    sections.push({ id: s.id, type: s.type, enabled: s.enabled, data: data.data as Record<string, unknown> });
  }
  if (d.customDomain) {
    const appHost = new URL(process.env.APP_URL ?? "https://branshee.com").hostname.replace(/^www\./, "");
    if (d.customDomain.replace(/^www\./, "") === appHost) return { ok: false, error: "Utilisez votre propre nom de domaine." };
    const [taken] = await db.select({ id: sites.id }).from(sites).where(and(eq(sites.customDomain, d.customDomain), ne(sites.id, site.id)));
    if (taken) return { ok: false, error: "Ce nom de domaine est déjà utilisé par un autre site." };
  }
  const social = Object.fromEntries(Object.entries(d.social).filter(([, v]) => v));
  await db
    .update(sites)
    .set({ sections, theme: { ...d.theme, headingFont: d.theme.headingFont || undefined }, seo: { title: d.seo.title || undefined, description: d.seo.description || undefined }, social, logoUrl: d.logoUrl || null, customDomain: d.customDomain || null })
    .where(eq(sites.id, site.id));
  revalidatePath("/app/site");
  revalidatePath(`/${ctx.business.slug}`);
  return { ok: true, message: "Site enregistré." };
}

/** Applique un modèle : remplace le thème et les sections ; garde logo, réseaux, domaine et coordonnées. */
export async function applySiteTemplate(templateId: string): Promise<Result> {
  const { ctx, site } = await ctxWithSite();
  if (!site) return LOCKED;
  const tpl = SITE_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) return { ok: false, error: "Modèle inconnu." };
  const [b] = await db.select().from(businesses).where(eq(businesses.id, ctx.business.id));
  const sections = structuredClone(tpl.sections).map((s) =>
    s.type === "contact" ? { ...s, data: { ...s.data, phone: (s.data.phone as string) || b?.phone || "", email: (s.data.email as string) || b?.email || "", address: (s.data.address as string) || [b?.address, b?.postalCode, b?.city].filter(Boolean).join(", ") } } : s,
  );
  await db.update(sites).set({ sections, theme: tpl.theme, seo: tpl.seo, template: tpl.id }).where(eq(sites.id, site.id));
  revalidatePath("/app/site");
  return { ok: true, message: `Modèle « ${tpl.name} » appliqué.` };
}

export async function setSitePublished(published: boolean): Promise<Result> {
  const { ctx, site } = await ctxWithSite();
  if (!site) return LOCKED;
  await db.update(sites).set({ publishedAt: published ? new Date() : null }).where(eq(sites.id, site.id));
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: published ? "site.published" : "site.unpublished", description: published ? "Site publié" : "Site retiré (la page de réservation reprend sa place)" });
  revalidatePath("/app/site");
  revalidatePath(`/${ctx.business.slug}`);
  return { ok: true, message: published ? "Votre site est en ligne." : "Site retiré : votre page de réservation est affichée à la place." };
}

export async function uploadSiteImage(fd: FormData): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { site } = await ctxWithSite();
  if (!site) return LOCKED;
  const f = fd.get("file");
  if (!(f instanceof File) || !f.size) return { ok: false, error: "Aucun fichier." };
  if (f.size > 8 * 1024 * 1024) return { ok: false, error: "Image trop lourde (8 Mo maximum)." };
  try {
    return { ok: true, url: await savePublicImage(Buffer.from(await f.arrayBuffer())) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Image refusée." };
  }
}

const contactSchema = z.object({ name: z.string().trim().min(2, "Indiquez votre nom.").max(120), email: z.email("Adresse email invalide."), message: z.string().trim().min(5, "Votre message est vide.").max(4000) });

/** Formulaire de contact du site : email au propriétaire de l'établissement (réponse directe au visiteur). */
export async function sendSiteContact(businessId: string, input: { name: string; email: string; message: string; website?: string }): Promise<Result> {
  if (input.website) return { ok: true };
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const ip = (clientIp(await headers()) ?? "local");
  if (!rateLimit(`site-contact:${ip}`, 5, 60 * 60 * 1000).ok) return { ok: false, error: "Trop de messages envoyés : réessayez plus tard." };
  const [row] = await db
    .select({ name: businesses.name, email: users.email, published: sites.publishedAt })
    .from(businesses)
    .innerJoin(users, eq(users.id, businesses.ownerId))
    .innerJoin(sites, eq(sites.businessId, businesses.id))
    .where(and(eq(businesses.id, z.uuid().parse(businessId)), isNull(businesses.deletedAt)));
  if (!row?.published) return { ok: false, error: "Ce site n'est plus disponible." };
  const mail = emails.siteContact({ businessName: row.name, ...parsed.data });
  const ok = await sendEmail({ to: row.email, ...mail, template: "site_contact", replyTo: parsed.data.email, businessId });
  return ok ? { ok: true, message: "Message envoyé, merci !" } : { ok: false, error: "L'envoi a échoué, réessayez." };
}
