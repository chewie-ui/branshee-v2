"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { activityLogs, businesses } from "@/db/schema";
import { clientIp } from "@/lib/client-ip";
import { CALLBACK_MOMENTS, CONTACT_MODES, isContactMode, isPhone } from "@/lib/contact-mode";
import { rateLimit } from "@/server/auth/rate-limit";
import { recordContact } from "@/server/contact-messages";
import { contactSettingsBySlug } from "@/server/contact-settings";
import { requireContext } from "@/server/context";

type Result = { ok: true; message?: string } | { ok: false; error: string };

/** Réglages › Établissement : comment les clients vous joignent (site, vitrine, widget, API). */
export async function saveContactMode(fd: FormData): Promise<Result> {
  const ctx = await requireContext("business.manage", { write: true });
  const mode = String(fd.get("contactMode") ?? "");
  if (!isContactMode(mode)) return { ok: false, error: "Choix invalide." };
  const note = String(fd.get("contactNote") ?? "").trim().slice(0, 160) || null;
  const [b] = await db.select({ phone: businesses.phone }).from(businesses).where(eq(businesses.id, ctx.business.id));
  if (mode === "phone" && !b?.phone) return { ok: false, error: "Ajoutez d'abord votre numéro de téléphone (ci-dessus) pour être appelé." };
  await db.update(businesses).set({ contactMode: mode, contactNote: note }).where(eq(businesses.id, ctx.business.id));
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "business.contact_mode", description: `Contact des visiteurs : ${CONTACT_MODES[mode].label}` });
  revalidatePath("/app/reglages", "layout");
  return { ok: true, message: "Enregistré : appliqué à votre site, votre vitrine et vos formulaires." };
}

const callbackSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  name: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  phone: z.string().trim().max(30).refine(isPhone, "Numéro de téléphone invalide."),
  moment: z.enum(Object.keys(CALLBACK_MOMENTS) as [keyof typeof CALLBACK_MOMENTS, ...(keyof typeof CALLBACK_MOMENTS)[]]).catch("any"),
  /** Ce qui intéresse le visiteur (ex. le véhicule de la fiche). */
  about: z.string().trim().max(160).optional(),
  pageUrl: z.string().trim().max(300).optional(),
  /** Champ piège invisible : rempli seulement par les robots. */
  website: z.string().max(0).optional(),
});

/** « Rappelez-moi » : nom + numéro, rangé dans « Messages du site » comme une demande à rappeler (pas de long message). */
export async function requestCallback(input: z.input<typeof callbackSchema>): Promise<Result> {
  if (input.website) return { ok: true, message: "C'est noté, vous serez rappelé." };
  const v = callbackSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Vérifiez les champs." };
  const ip = clientIp(await headers()) ?? "local";
  if (!rateLimit(`callback:${ip}`, 5, 60 * 60_000).ok || !rateLimit(`callback-biz:${v.data.slug}`, 60, 60 * 60_000).ok) return { ok: false, error: "Trop de demandes envoyées : réessayez plus tard." };
  const s = await contactSettingsBySlug(v.data.slug);
  if (!s) return { ok: false, error: "Demande impossible pour le moment." };
  if (s.mode === "phone") return { ok: false, error: s.phone ? `Appelez directement le ${s.phone}.` : "Appelez directement le professionnel." };
  const moment = CALLBACK_MOMENTS[v.data.moment];
  const r = await recordContact(
    s.id,
    { name: v.data.name, email: null, phone: v.data.phone, subject: `À rappeler${v.data.about ? ` : ${v.data.about}` : ""}`, message: `Rappel demandé au ${v.data.phone}. Moment souhaité : ${moment.toLowerCase()}.`, pageUrl: v.data.pageUrl || null },
    "site",
  );
  return r ? { ok: true, message: `C'est noté ! ${s.name} vous rappelle au ${v.data.phone}.` } : { ok: false, error: "L'envoi a échoué, réessayez." };
}
