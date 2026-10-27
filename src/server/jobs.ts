import "server-only";
import { and, count, eq, gt, isNotNull, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, articles, businessPlans, businesses, members, notificationSettings, services, users } from "@/db/schema";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { indexNow } from "@/server/indexnow";
import { effectivePlan } from "@/server/plan";
import { trialValues } from "@/server/business";
import { syncSkydevUsers } from "@/server/billing";

/**
 * Tâches planifiées (appelées par la crontab du VPS via /api/cron/*).
 * Chacune est idempotente : la relancer ne renvoie jamais deux fois le même email.
 */
const appUrl = () => (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");
const H = 3600000;
const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;

/** Articles programmés dont l'heure est passée → publiés. */
export async function publishScheduledArticles(now = new Date()) {
  const rows = await db
    .update(articles)
    .set({ status: "published", publishedAt: sql`coalesce(${articles.scheduledFor}, now())` })
    .where(and(eq(articles.status, "scheduled"), isNotNull(articles.scheduledFor), lte(articles.scheduledFor, now)))
    .returning({ slug: articles.slug });
  if (rows.length) await indexNow([...rows.map((r) => `/blog/${r.slug}`), "/blog"]);
  return rows.length;
}

/** Étapes « Bien démarrer » d'un établissement (mêmes critères que la checklist du tableau de bord). */
async function onboardingSteps(businessId: string) {
  const [[b], [svc], [appt]] = await Promise.all([
    db.select({ photoUrl: businesses.photoUrl, onboarding: businesses.onboarding }).from(businesses).where(eq(businesses.id, businessId)),
    db.select({ n: count() }).from(services).where(eq(services.businessId, businessId)),
    db.select({ n: count() }).from(appointments).where(and(eq(appointments.businessId, businessId), eq(appointments.kind, "appointment"))),
  ]);
  if (!b) return null;
  return {
    dismissed: !!b.onboarding.dismissedAt,
    missing: [
      { done: (svc?.n ?? 0) > 0, title: "Créez votre première prestation", desc: "Ce que vos clients pourront réserver, avec durée et prix." },
      { done: !!b.photoUrl, title: "Ajoutez votre logo ou une photo", desc: "Il s'affiche sur votre page de réservation." },
      { done: !!b.onboarding.linkSharedAt, title: "Partagez votre lien de réservation", desc: "Sur Google, Instagram, WhatsApp, votre site…" },
      { done: (appt?.n ?? 0) > 0, title: "Recevez votre premier rendez-vous", desc: "Testez vous-même votre page pour voir ce que voit un client." },
    ].filter((s) => !s.done),
  };
}

/** Relances « Bien démarrer » aux nouveaux pros : J+1 puis J+3, tant que la configuration n'est pas finie. */
export async function sendOnboardingNudges(now = new Date()) {
  const candidates = await db
    .select({ id: users.id, email: users.email, name: users.fullName, createdAt: users.createdAt, nudges: users.nudges })
    .from(users)
    .where(
      and(
        gt(users.createdAt, new Date(now.getTime() - 30 * 24 * H)),
        lte(users.createdAt, new Date(now.getTime() - 24 * H)),
        isNull(users.disabledAt),
        eq(users.emailNotifications, true),
        sql`coalesce(${users.signupIntent}, 'pro') <> 'client'`,
        sql`coalesce((${users.nudges}->>'onboardingStage')::int, 0) < 2`,
        sql`${users.email} not like '%@branshee.invalid'`,
      ),
    );
  let sent = 0;
  for (const u of candidates) {
    try {
      const [biz] = await db.select({ id: businesses.id }).from(businesses).where(and(eq(businesses.ownerId, u.id), isNull(businesses.deletedAt))).orderBy(businesses.createdAt).limit(1);
      if (!biz) continue;
      const age = (now.getTime() - u.createdAt.getTime()) / H;
      const stage = u.nudges.onboardingStage ?? 0;
      const target = stage === 0 && age >= 24 ? 1 : stage === 1 && age >= 72 ? 2 : 0;
      if (!target) continue;
      const status = await onboardingSteps(biz.id);
      if (!status) continue;
      if (status.dismissed || status.missing.length === 0) {
        await db.update(users).set({ nudges: { ...u.nudges, onboardingStage: 2 } }).where(eq(users.id, u.id));
        continue;
      }
      const mail = emails.onboardingNudge({ name: firstName(u.name), steps: status.missing, stage: target as 1 | 2, url: `${appUrl()}/app` });
      if (await sendEmail({ to: u.email, ...mail, template: "onboarding_nudge", businessId: biz.id })) {
        await db.update(users).set({ nudges: { ...u.nudges, onboardingStage: target } }).where(eq(users.id, u.id));
        sent++;
      }
    } catch (e) {
      console.error("[jobs] relance bien démarrer :", e instanceof Error ? e.message : e);
    }
  }
  return sent;
}

/** Une seule fois : « créez votre établissement » aux inscrits (hors clients) qui n'en ont aucun. */
export async function sendCreateBusinessNudges(now = new Date()) {
  const candidates = await db
    .select({ id: users.id, email: users.email, name: users.fullName, nudges: users.nudges })
    .from(users)
    .where(
      and(
        gt(users.createdAt, new Date(now.getTime() - 30 * 24 * H)),
        lte(users.createdAt, new Date(now.getTime() - 24 * H)),
        isNull(users.disabledAt),
        eq(users.emailNotifications, true),
        sql`coalesce(${users.signupIntent}, 'pro') <> 'client'`,
        sql`${users.nudges}->>'createBusinessAt' is null`,
        sql`${users.email} not like '%@branshee.invalid'`,
        // Ni propriétaire, ni membre d'une équipe.
        sql`not exists (select 1 from ${members} m where m.user_id = ${users.id} and m.status in ('active', 'invited', 'requested'))`,
        sql`not exists (select 1 from ${businesses} b where b.owner_id = ${users.id} and b.deleted_at is null)`,
      ),
    );
  let sent = 0;
  for (const u of candidates) {
    const mail = emails.createBusinessNudge({ name: firstName(u.name), url: `${appUrl()}/bienvenue` });
    if (await sendEmail({ to: u.email, ...mail, template: "create_business_nudge" })) {
      await db.update(users).set({ nudges: { ...u.nudges, createBusinessAt: now.toISOString() } }).where(eq(users.id, u.id));
      sent++;
    }
  }
  return sent;
}

/** Accès offert qui se termine : relance à J-7 puis J-1 (repart de zéro si l'échéance change). */
export async function sendGrantExpiryReminders(now = new Date()) {
  const rows = await db
    .select({ plan: businessPlans, name: businesses.name, ownerEmail: users.email, ownerName: users.fullName, tz: businesses.timezone })
    .from(businessPlans)
    .innerJoin(businesses, eq(businesses.id, businessPlans.businessId))
    .innerJoin(users, eq(users.id, businesses.ownerId))
    .where(
      and(
        isNotNull(businessPlans.grantedUntil),
        gt(businessPlans.grantedUntil, now),
        lte(businessPlans.grantedUntil, new Date(now.getTime() + 8 * 24 * H)),
        isNull(businessPlans.stripeSubscriptionId),
        ne(businessPlans.plan, "free"),
        isNull(businesses.deletedAt),
        isNull(users.disabledAt),
      ),
    );
  let sent = 0;
  for (const r of rows) {
    const until = r.plan.grantedUntil!;
    const daysLeft = Math.ceil((until.getTime() - now.getTime()) / (24 * H));
    const target = daysLeft <= 1 ? 2 : daysLeft <= 7 ? 1 : 0;
    if (!target) continue;
    const same = r.plan.grantReminder.sentFor === until.toISOString();
    if ((same ? (r.plan.grantReminder.stage ?? 0) : 0) >= target) continue;
    const [b30] = await db.select({ n: count() }).from(appointments).where(and(eq(appointments.businessId, r.plan.businessId), eq(appointments.kind, "appointment"), gt(appointments.createdAt, new Date(now.getTime() - 30 * 24 * H))));
    const label = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric", timeZone: r.tz }).format(until);
    const mail = emails.grantExpiry({ name: firstName(r.ownerName), businessName: r.name, daysLeft, until: label, bookings30: b30?.n ?? 0, url: `${appUrl()}/app/reglages/abonnement`, trial: r.plan.isTrial });
    if (await sendEmail({ to: r.ownerEmail, ...mail, template: "grant_expiry", businessId: r.plan.businessId })) {
      await db.update(businessPlans).set({ grantReminder: { sentFor: until.toISOString(), stage: target } }).where(eq(businessPlans.businessId, r.plan.businessId));
      sent++;
    }
  }
  return sent;
}

/** Essai ou accès offert terminé depuis moins de 3 jours : un email « réservation fermée », une seule fois. */
export async function sendPlanEndedNotices(now = new Date()) {
  const rows = await db
    .select({ plan: businessPlans, name: businesses.name, ownerEmail: users.email, ownerName: users.fullName })
    .from(businessPlans)
    .innerJoin(businesses, eq(businesses.id, businessPlans.businessId))
    .innerJoin(users, eq(users.id, businesses.ownerId))
    .where(
      and(
        isNotNull(businessPlans.grantedUntil),
        lte(businessPlans.grantedUntil, now),
        gt(businessPlans.grantedUntil, new Date(now.getTime() - 3 * 24 * H)),
        isNull(businessPlans.stripeSubscriptionId),
        ne(businessPlans.plan, "free"),
        isNull(businesses.deletedAt),
        isNull(businesses.pausedAt),
        isNull(users.disabledAt),
      ),
    );
  let sent = 0;
  for (const r of rows) {
    const until = r.plan.grantedUntil!.toISOString();
    if (r.plan.grantReminder.sentFor === until && (r.plan.grantReminder.stage ?? 0) >= 3) continue;
    const mail = emails.planEnded({ name: firstName(r.ownerName), businessName: r.name, url: `${appUrl()}/app/reglages/abonnement`, trial: r.plan.isTrial });
    if (await sendEmail({ to: r.ownerEmail, ...mail, template: "plan_ended", businessId: r.plan.businessId })) {
      await db.update(businessPlans).set({ grantReminder: { sentFor: until, stage: 3 } }).where(eq(businessPlans.businessId, r.plan.businessId));
      sent++;
    }
  }
  return sent;
}


/** Bascule vers l'essai 30 jours : essai Pro pour chaque établissement existant sans forfait, avec un email au propriétaire. */
export async function startTrialsForExisting(now = new Date()) {
  const rows = await db
    .select({ id: businesses.id, name: businesses.name, ownerEmail: users.email, ownerName: users.fullName, tz: businesses.timezone, plan: businessPlans })
    .from(businesses)
    .innerJoin(users, eq(users.id, businesses.ownerId))
    .leftJoin(businessPlans, eq(businessPlans.businessId, businesses.id))
    .where(and(isNull(businesses.deletedAt), isNull(users.disabledAt)));
  let started = 0;
  let emailed = 0;
  for (const r of rows) {
    // Déjà abonné, déjà en essai/accès offert, ou ancien abonnement porté par le compte : on ne touche à rien.
    if (r.plan && (r.plan.plan !== "free" || r.plan.isTrial || r.plan.grantedUntil)) continue;
    if ((await effectivePlan(r.id)).plan !== "free") continue;
    const values = trialValues(now);
    await db.insert(businessPlans).values({ businessId: r.id, ...values }).onConflictDoUpdate({ target: businessPlans.businessId, set: values });
    await db.insert(notificationSettings).values({ businessId: r.id, smsReminders: true }).onConflictDoUpdate({ target: notificationSettings.businessId, set: { smsReminders: true } });
    started++;
    if (r.ownerEmail.endsWith("@branshee.invalid")) continue;
    const until = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "long", year: "numeric", timeZone: r.tz }).format(values.grantedUntil);
    const mail = emails.trialStarted({ name: firstName(r.ownerName), businessName: r.name, until, url: `${appUrl()}/app/reglages/abonnement` });
    if (await sendEmail({ to: r.ownerEmail, ...mail, template: "trial_started", businessId: r.id })) emailed++;
  }
  return { started, emailed };
}

/**
 * Skydev : rattrape chaque jour les abonnements par utilisateur dont la quantité Stripe ne suit plus l'équipe
 * (Stripe indisponible au moment d'un ajout, membre désactivé hors de l'app…).
 */
export async function reconcileSkydevUsers() {
  const rows = await db.select({ id: businessPlans.businessId }).from(businessPlans).where(and(isNotNull(businessPlans.billedUsers), isNotNull(businessPlans.stripeSubscriptionId)));
  let fixed = 0;
  for (const r of rows) {
    const before = await db.select({ n: businessPlans.billedUsers }).from(businessPlans).where(eq(businessPlans.businessId, r.id));
    await syncSkydevUsers(r.id).catch((e) => console.error("[cron] utilisateurs Skydev", r.id, e));
    const after = await db.select({ n: businessPlans.billedUsers }).from(businessPlans).where(eq(businessPlans.businessId, r.id));
    if (before[0]?.n !== after[0]?.n) fixed++;
  }
  return fixed;
}
