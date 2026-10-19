import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { db } from "@/db";
import { emailLogs } from "@/db/schema";
import { isStaging } from "@/lib/staging";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  replyTo?: string | null;
  businessId?: string | null;
  appointmentId?: string | null;
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

export async function sendEmail(mail: OutgoingEmail): Promise<boolean> {
  const from = process.env.MAIL_FROM ?? "Branshee <no-reply@branshee.com>";
  const transport = getTransport();
  let status: "sent" | "failed" | "logged" = "logged";
  let error: string | null = null;

  // Version de test : aucun email ne part vers les vrais destinataires.
  const staging = isStaging();
  const redirect = staging ? process.env.STAGING_EMAIL_TO?.trim() : null;
  try {
    if (transport && (!staging || redirect)) {
      await transport.sendMail({ from, to: redirect || mail.to, subject: redirect ? `[TEST → ${mail.to}] ${mail.subject}` : mail.subject, html: mail.html, text: mail.text, replyTo: redirect ? undefined : (mail.replyTo ?? undefined) });
      status = "sent";
    } else {
      console.info(`\n[email:dev] → ${mail.to}\n  Sujet : ${mail.subject}\n${mail.text.split("\n").map((l) => "  " + l).join("\n")}\n`);
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
