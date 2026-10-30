import "server-only";
import { isDemoBusiness } from "@/server/demo-flag";
import nodemailer, { type Transporter } from "nodemailer";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { businesses, emailLogs } from "@/db/schema";
import { isStaging } from "@/lib/staging";
import { brandForHost, visitedHost } from "@/lib/brand";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  replyTo?: string | null;
  businessId?: string | null;
  appointmentId?: string | null;
  /** En-têtes supplémentaires (ex. List-Unsubscribe des campagnes). */
  headers?: Record<string, string>;
};

let transporter: Transporter | null | undefined;

/**
 * Transport SMTP défini par SMTP_URL (ex. smtps://user:pass@smtp-relay.brevo.com:465).
 * Sans SMTP_URL (développement), les emails ne partent pas : ils sont affichés dans la console
 * et journalisés avec le statut « logged ».
 */
function getTransport() {
  if (transporter !== undefined) return transporter;
  transporter = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
  return transporter;
}

/**
 * Marque de la requête qui déclenche l'email (inscription, code, invitation… faits sur une adresse Skydev).
 * Hors requête (tâches planifiées), `headers()` est indisponible : on garde Branshee.
 */
async function requestBrand() {
  try {
    const { headers } = await import("next/headers");
    return brandForHost(visitedHost(await headers()));
  } catch {
    return process.env.FORCE_BRAND === "skydev" ? ("skydev" as const) : ("branshee" as const);
  }
}

/** La marque de l'établissement concerné passe avant l'adresse visitée (tâches planifiées, emails à l'équipe). */
async function mailBrand(businessId?: string | null) {
  if (businessId) {
    const [b] = await db.select({ brand: businesses.brand }).from(businesses).where(eq(businesses.id, businessId)).catch(() => []);
    if (b?.brand === "skydev" || b?.brand === "branshee") return b.brand;
  }
  return requestBrand();
}

/** Emails déclenchés depuis Skydev : le nom « Branshee » devient « Skydev » (les liens restent ceux de l'app). */
function asSkydev(mail: OutgoingEmail): OutgoingEmail {
  const swap = (t: string) => t.replace(/Branshee/g, "Skydev");
  return { ...mail, subject: swap(mail.subject), html: swap(mail.html), text: swap(mail.text) };
}

export async function sendEmail(input: OutgoingEmail): Promise<boolean> {
  const skydev = (await mailBrand(input.businessId)) === "skydev";
  const mail = skydev ? asSkydev(input) : input;
  const from = skydev ? (process.env.MAIL_FROM_SKYDEV ?? "Skydev <no-reply@branshee.com>") : (process.env.MAIL_FROM ?? "Branshee <no-reply@branshee.com>");
  const transport = getTransport();
  let status: "sent" | "failed" | "logged" = "logged";
  let error: string | null = null;

  // Version de test : aucun email ne part vers les vrais destinataires.
  const staging = isStaging();
  const redirect = staging ? process.env.STAGING_EMAIL_TO?.trim() : null;
  try {
    // Compte de démonstration : adresse fictive, rien ne part.
    if (/@demo\.skydev\.be$/i.test(mail.to) || (input.businessId && (await isDemoBusiness(input.businessId)))) status = "logged";
    else if (transport && (!staging || redirect)) {
      await transport.sendMail({ from, to: redirect || mail.to, subject: redirect ? `[TEST → ${mail.to}] ${mail.subject}` : mail.subject, html: mail.html, text: mail.text, replyTo: redirect ? undefined : (mail.replyTo ?? undefined), headers: mail.headers });
      status = "sent";
    } else {
      // En production, jamais le contenu (codes, noms de patients) dans les journaux.
      if (process.env.NODE_ENV === "production") console.warn(`[email] non envoyé (SMTP absent) : ${mail.template} → @${mail.to.split("@")[1] ?? "?"}`);
      else console.info(`\n[email:dev] → ${mail.to}\n  Sujet : ${mail.subject}\n${mail.text.split("\n").map((l) => "  " + l).join("\n")}\n`);
    }
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message.slice(0, 500) : String(e);
    console.error(`[email] échec d'envoi à ${mail.to} :`, error);
  }

  await db
    .insert(emailLogs)
    .values({ businessId: mail.businessId ?? null, appointmentId: mail.appointmentId ?? null, template: mail.template, toEmail: mail.to, subject: mail.subject, status, error })
    .catch((e) => console.error("[email] journalisation impossible :", e));
  return status !== "failed";
}
