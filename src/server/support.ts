import "server-only";
import { and, asc, desc, eq, gt, gte, isNull, notExists, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminMessageDismissals, adminMessages, helpSections, supportMessages, supportThreads } from "@/db/schema";

export type SupportMessageView = { id: string; sender: "user" | "admin"; kind: "message" | "system"; body: string; image: boolean; createdAt: string };
export type SupportThreadView = { closedAt: string | null; closedBy: "user" | "admin" | null; rated: boolean; unread: number; otherTyping: boolean; otherReadAt: string | null };
export type SupportLive = { thread: SupportThreadView | null; messages: SupportMessageView[]; now: string };

/** « En train d'écrire » : dernière frappe il y a moins de 6 secondes. */
const TYPING_MS = 6000;

const view = (m: typeof supportMessages.$inferSelect): SupportMessageView => ({ id: m.id, sender: m.sender, kind: m.kind, body: m.body, image: !!m.imageRef, createdAt: m.createdAt.toISOString() });

/**
 * État du chat de support vu d'un côté (le pro ou l'équipe) : messages (tous, ou depuis `since`),
 * l'autre côté en train d'écrire, et jusqu'où il a lu (« Vu »). `markRead` : ce côté a la discussion sous les yeux.
 */
export async function supportLive(userId: string, side: "user" | "admin", opts: { since?: Date | null; markRead?: boolean } = {}): Promise<SupportLive> {
  const [t] = await db.select().from(supportThreads).where(eq(supportThreads.userId, userId));
  const now = new Date();
  if (!t) return { thread: null, messages: [], now: now.toISOString() };
  const rows = opts.since
    ? await db.select().from(supportMessages).where(and(eq(supportMessages.threadUserId, userId), gte(supportMessages.createdAt, opts.since))).orderBy(asc(supportMessages.createdAt)).limit(200)
    : (await db.select().from(supportMessages).where(eq(supportMessages.threadUserId, userId)).orderBy(desc(supportMessages.createdAt)).limit(300)).reverse();
  if (opts.markRead) {
    await db.update(supportThreads).set(side === "user" ? { unreadByUser: 0, userReadAt: now } : { unreadByAdmin: 0, adminReadAt: now }).where(eq(supportThreads.userId, userId));
  }
  const otherTypingAt = side === "user" ? t.adminTypingAt : t.userTypingAt;
  const otherReadAt = side === "user" ? t.adminReadAt : t.userReadAt;
  return {
    thread: {
      closedAt: t.closedAt?.toISOString() ?? null,
      closedBy: t.closedBy ?? null,
      rated: !!t.rating,
      unread: opts.markRead ? 0 : side === "user" ? t.unreadByUser : t.unreadByAdmin,
      otherTyping: !!otherTypingAt && now.getTime() - otherTypingAt.getTime() < TYPING_MS,
      otherReadAt: otherReadAt?.toISOString() ?? null,
    },
    messages: rows.map(view),
    now: now.toISOString(),
  };
}

/** Conversation de support d'un pro (première affichage de la page d'aide). */
export async function getSupportThread(userId: string) {
  return supportLive(userId, "user");
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

/** Aide de base Skydev (plateforme d'apps) quand le super-admin n'a encore rien rédigé. */
export const DEFAULT_HELP_SKYDEV: typeof DEFAULT_HELP = [
  {
    title: "Questions fréquentes",
    videos: [],
    faqs: [
      { id: "apps", question: "Comment ajouter ou retirer une app de mon accueil ?", answer: "Sur l'accueil, cliquez sur <strong>Modifier l'accueil</strong>. Les autres apps sont en dessous, dans « Ajouter des apps ». Toutes sont incluses dans l'abonnement, sauf les options." },
      { id: "switch", question: "Comment passer vite d'une app à l'autre ?", answer: "Appuyez sur <strong>Ctrl + K</strong> (⌘ + K sur Mac) ou cliquez sur la loupe, puis tapez le nom de l'app ou de la page. Épinglez aussi vos apps favorites : elles apparaissent en raccourci dans chaque app." },
      { id: "team", question: "Comment ajouter un collaborateur ?", answer: "Allez dans <strong>Équipe</strong>, « Ajouter un membre ». Avec son e-mail, il reçoit une invitation et crée son compte. Son grade décide des apps qu'il voit." },
      { id: "plan", question: "Combien coûte Skydev et comment m'abonner ?", answer: "Toutes les apps sont incluses : 29 € par mois pour la première personne, puis moins cher par personne en plus. Allez dans <strong>Réglages → Abonnement</strong>." },
      { id: "custom", question: "Il me manque une fonction, que faire ?", answer: "Ouvrez <strong>Sur mesure</strong> (ou le lien « Une idée pour… » dans chaque app) et décrivez ce que vous voulez. Vous recevez un prix fixe avant tout travail." },
      { id: "find", question: "Comment les clients me trouvent-ils ?", answer: "Votre page publique apparaît dans l'annuaire de Skydev, par métier et par ville. Complétez-la (photo, présentation, adresse, prestations, horaires) : la carte « Faites-vous trouver » de l'accueil vous dit ce qu'il manque." },
    ],
  },
];
