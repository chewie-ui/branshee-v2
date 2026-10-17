import "server-only";
import { and, asc, desc, eq, gt, isNull, notExists, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminMessageDismissals, adminMessages, helpSections, supportMessages, supportThreads } from "@/db/schema";

export type SupportMessageView = { id: string; sender: "user" | "admin"; body: string; createdAt: string };

/** Conversation de support d'un pro (les 300 derniers messages). */
export async function getSupportThread(userId: string) {
  const [thread] = await db.select().from(supportThreads).where(eq(supportThreads.userId, userId));
  if (!thread) return { thread: null, messages: [] as SupportMessageView[] };
  const rows = await db.select().from(supportMessages).where(eq(supportMessages.threadUserId, userId)).orderBy(desc(supportMessages.createdAt)).limit(300);
  return {
    thread: { unreadByUser: thread.unreadByUser, closedAt: thread.closedAt?.toISOString() ?? null, rated: !!thread.rating },
    messages: rows.reverse().map((m) => ({ id: m.id, sender: m.sender, body: m.body, createdAt: m.createdAt.toISOString() })),
  };
}

export async function supportUnread(userId: string) {
  const [t] = await db.select({ n: supportThreads.unreadByUser }).from(supportThreads).where(eq(supportThreads.userId, userId));
  return t?.n ?? 0;
}

/** Messages de l'équipe Branshee à afficher (destinés à tous ou à ce compte, non fermés, 60 derniers jours). */
export async function activeAdminMessages(userId: string) {
  return db
    .select({ id: adminMessages.id, title: adminMessages.title, body: adminMessages.body, type: adminMessages.type, ctaLabel: adminMessages.ctaLabel, ctaUrl: adminMessages.ctaUrl, createdAt: adminMessages.createdAt })
    .from(adminMessages)
    .where(
      and(
        or(isNull(adminMessages.recipientId), eq(adminMessages.recipientId, userId)),
        gt(adminMessages.createdAt, sql`now() - interval '60 days'`),
        notExists(db.select({ x: sql`1` }).from(adminMessageDismissals).where(and(eq(adminMessageDismissals.messageId, adminMessages.id), eq(adminMessageDismissals.userId, userId)))),
      ),
    )
    .orderBy(desc(adminMessages.createdAt))
    .limit(5);
}

export async function listHelpSections() {
  return db.select().from(helpSections).orderBy(asc(helpSections.position), asc(helpSections.createdAt));
}

/** Contenu affiché tant que l'équipe n'a rien rédigé dans l'éditeur du centre d'aide. */
export const DEFAULT_HELP: { title: string; videos: { id: string; title: string; url: string; duration?: string }[]; faqs: { id: string; question: string; answer: string }[] }[] = [
  {
    title: "Questions fréquentes",
    videos: [],
    faqs: [
      { id: "share", question: "Comment partager ma page de réservation ?", answer: "Ouvrez <strong>Page de réservation → Partager</strong> : copiez votre lien, téléchargez le QR code ou intégrez un bouton sur votre site." },
      { id: "team", question: "Comment ajouter un collaborateur ?", answer: "Allez dans <strong>Équipe</strong> et cliquez sur « Ajouter un membre ». Avec son email, il reçoit une invitation et rejoint l'équipe avec son propre compte." },
      { id: "plan", question: "Comment passer au forfait Pro ?", answer: "Allez dans <strong>Réglages → Abonnement</strong> et choisissez votre forfait. Le changement est immédiat, au prorata." },
      { id: "confirm", question: "Mes clients reçoivent-ils une confirmation ?", answer: "Oui : un email de confirmation part à chaque réservation, puis un rappel avant le rendez-vous (réglable dans <strong>Réglages → Notifications</strong>)." },
      { id: "dayoff", question: "Comment bloquer un jour de congé ?", answer: "Dans <strong>Horaires</strong>, section « Congés et fermetures » : choisissez les dates, plus aucune réservation n'est possible sur cette période." },
      { id: "cancel", question: "Un client peut-il annuler ou déplacer son rendez-vous ?", answer: "Oui, depuis le lien reçu par email, dans les délais que vous fixez dans <strong>Réglages → Réservation</strong>." },
    ],
  },
];
