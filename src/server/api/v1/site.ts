import "server-only";
import { headers } from "next/headers";
import { deleteContactMessage, setMessageRead } from "@/server/actions/connect";
import { applySiteTemplate, saveSite, setSitePublished } from "@/server/actions/site";
import { bool, fail, forbidden, has, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { contactMessagesOf } from "@/server/contact-messages";
import { currentContext, type AppContext } from "@/server/context";
import { businessHas, isLocked } from "@/server/plan";
import { getOrCreateSite } from "@/server/site-builder";
import { SECTION_LABELS, SITE_TEMPLATES, type SiteSection } from "@/lib/site-templates";

/**
 * API mobile de l'app Site web (Skydev) : statut, lien, visites, publication, référencement, réseaux, domaine,
 * modèles et messages du formulaire de contact. L'éditeur visuel des sections reste sur le site.
 */

async function needSite(): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("site")) return forbidden();
  const method = (await headers()).get("x-method") ?? "POST";
  if (method !== "GET" && (await isLocked(ctx.business.id, ctx.business.brand))) return fail(402, "read_only", "Votre essai est terminé : abonnez-vous pour continuer à modifier.");
  return ctx;
}

type Res = { ok: boolean; error?: string; message?: string };
const ok = (r: Res) => (r.ok ? r : invalid(r.error ?? "Action impossible."));
const base = () => (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");

async function overview() {
  const ctx = await needSite();
  if (!ctx.can("customization.manage")) return forbidden();
  if (!(await businessHas(ctx.business.id, "mySite"))) return { available: false, editorPath: "/app/site" };
  const site = await getOrCreateSite(ctx.business.id);
  const sections = (site.sections as SiteSection[]).map((s) => ({ id: s.id, type: s.type, label: SECTION_LABELS[s.type] ?? s.type, enabled: s.enabled }));
  return {
    available: true,
    editorPath: "/app/site",
    published: !!site.publishedAt,
    publicUrl: site.customDomain ? `https://${site.customDomain}` : `${base()}/${ctx.business.slug}`,
    visits: site.visitCount,
    template: site.template ?? null,
    seo: { title: site.seo.title ?? "", description: site.seo.description ?? "" },
    social: { instagram: "", facebook: "", tiktok: "", whatsapp: "", linkedin: "", youtube: "", ...site.social },
    customDomain: site.customDomain ?? "",
    appHost: new URL(base()).hostname,
    sections,
    templates: SITE_TEMPLATES.map((t) => ({ id: t.id, name: t.name, tagline: t.tagline, bestFor: t.bestFor, thumb: t.thumb })),
  };
}

/** Modifie les réglages simples (référencement, réseaux, domaine, sections visibles) en gardant le reste du site. */
async function patch(r: ApiRequest) {
  const ctx = await needSite();
  const site = await getOrCreateSite(ctx.business.id);
  const b = r.body;
  const seo = (b.seo ?? {}) as Record<string, unknown>;
  const social = (b.social ?? {}) as Record<string, unknown>;
  const enabled = (b.enabled ?? {}) as Record<string, unknown>;
  const curSocial = { instagram: "", facebook: "", tiktok: "", whatsapp: "", linkedin: "", youtube: "", ...site.social };
  ok(
    await saveSite({
      sections: (site.sections as SiteSection[]).map((s) => ({ ...s, enabled: has(enabled, s.id) ? bool(enabled[s.id]) : s.enabled })),
      theme: { ...site.theme, headingFont: site.theme.headingFont ?? "" },
      seo: { title: has(seo, "title") ? str(seo.title, 70) : (site.seo.title ?? ""), description: has(seo, "description") ? str(seo.description, 170) : (site.seo.description ?? "") },
      social: Object.fromEntries(Object.entries(curSocial).map(([k, v]) => [k, has(social, k) ? str(social[k], 200) : (v ?? "")])) as typeof curSocial,
      logoUrl: site.logoUrl ?? "",
      customDomain: has(b, "customDomain") ? str(b.customDomain, 120) : (site.customDomain ?? ""),
    }),
  );
  return overview();
}

async function messages() {
  const ctx = await needSite();
  if (!ctx.can("customers.view")) return forbidden();
  const rows = await contactMessagesOf(ctx.business.id);
  return {
    canManage: ctx.can("customers.manage"),
    messages: rows.map((m) => ({ id: m.id, name: m.name, email: m.email, phone: m.phone, subject: m.subject, message: m.message, source: m.source, pageUrl: m.pageUrl, customerId: m.customerId, read: !!m.readAt, createdAt: m.createdAt.toISOString() })),
  };
}

export const siteRoutes: Route[] = [
  { method: "GET", path: "/site", handler: overview },
  { method: "PATCH", path: "/site", handler: patch },
  {
    method: "POST",
    path: "/site/publish",
    handler: async (r) => {
      await needSite();
      ok(await setSitePublished(bool(r.body.published)));
      return overview();
    },
  },
  {
    method: "POST",
    path: "/site/template",
    handler: async (r) => {
      await needSite();
      ok(await applySiteTemplate(str(r.body.templateId, 60)));
      return overview();
    },
  },
  { method: "GET", path: "/site/messages", handler: messages },
  {
    method: "PATCH",
    path: "/site/messages/:id",
    handler: async (r) => {
      await needSite();
      ok(await setMessageRead(r.params.id!, bool(r.body.read)));
      return { ok: true };
    },
  },
  {
    method: "DELETE",
    path: "/site/messages/:id",
    handler: async (r) => {
      await needSite();
      ok(await deleteContactMessage(r.params.id!));
      return { ok: true };
    },
  },
];
