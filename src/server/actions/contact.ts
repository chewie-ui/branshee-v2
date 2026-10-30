"use server";

import { headers } from "next/headers";
import { z } from "@/lib/zod";
import { rateLimit } from "@/server/auth/rate-limit";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { clientIp } from "@/lib/client-ip";
import { currentBrand } from "@/server/brand";

export type ContactState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> } | undefined;

const schema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  email: z.email("Adresse email invalide."),
  subject: z.string().trim().min(2, "Indiquez un sujet.").max(150),
  message: z.string().trim().min(10, "Votre message est un peu court.").max(5000),
});

/** Formulaire de contact du site : email à l'équipe (réponse directe à l'expéditeur). */
export async function sendContact(_prev: ContactState, fd: FormData): Promise<ContactState> {
  const values = { name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? "").trim(), subject: String(fd.get("subject") ?? ""), message: String(fd.get("message") ?? "") };
  if (String(fd.get("website") ?? "")) return { ok: true }; // champ piège anti-robots
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors, values };
  }
  const ip = (clientIp(await headers()) ?? "local");
  if (!rateLimit(`contact:${ip}`, 5, 60 * 60 * 1000).ok) return { error: "Vous avez envoyé plusieurs messages : réessayez dans une heure, ou écrivez-nous directement par email.", values };
  // Demandes venues du site Skydev : boîte Skydev ; sinon le support Branshee.
  const to = (await currentBrand()).id === "skydev" ? process.env.SKYDEV_CONTACT_EMAIL || "info@skydev.be" : process.env.SUPPORT_EMAIL || "support@branshee.com";
  const ok = await sendEmail({ to, ...emails.contactMessage(parsed.data), template: "contact", replyTo: parsed.data.email });
  return ok ? { ok: true } : { error: "L'envoi a échoué. Réessayez dans un instant, ou écrivez-nous par email.", values };
}
