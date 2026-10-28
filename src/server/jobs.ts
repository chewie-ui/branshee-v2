import "server-only";
import { and, count, eq, gt, inArray, isNotNull, isNull, lte, ne, sql, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { appointments, articles, businessPlans, businesses, deals, emailLogs, members, products, notificationSettings, reviewSettings, services, users } from "@/db/schema";
import { deliverReviewRequest } from "@/server/google-reviews";
import { sendEmail } from "@/server/email/mailer";
import { emails } from "@/server/email/templates";
import { indexNow } from "@/server/indexnow";
import { effectivePlan, isLocked } from "@/server/plan";
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

/**
 * App Ventes : chaque matin, à chaque responsable de piste, la liste de ses relances du jour et en retard.
 * Un seul email par personne, seulement s'il y a quelque chose à faire.
 */
export async function sendSalesFollowUps(now = new Date()) {
  const rows = await db
    .select({ title: deals.title, next: deals.nextActionDate, what: deals.nextAction, company: deals.companyName, tz: businesses.timezone, businessId: businesses.id, biz: businesses.name, email: users.email, name: members.displayName, memberId: members.id })
    .from(deals)
    .innerJoin(businesses, eq(businesses.id, deals.businessId))
    .innerJoin(members, eq(members.id, deals.ownerMemberId))
    .innerJoin(users, eq(users.id, members.userId))
    .where(and(isNotNull(deals.nextActionDate), lte(deals.nextActionDate, sql`(now() at time zone coalesce(${businesses.timezone}, 'Europe/Brussels'))::date`), sql`${deals.stage} not in ('won','lost')`, isNull(businesses.deletedAt), eq(members.status, "active"), eq(members.isActive, true)))
    .limit(5000);
  const byMember = new Map<string, typeof rows>();
  for (const r of rows) byMember.set(r.memberId, [...(byMember.get(r.memberId) ?? []), r]);
  let sent = 0;
  for (const list of byMember.values()) {
    const first = list[0]!;
    // Une seule fois par jour, même si la tâche est relancée.
    const [already] = await db.select({ id: emailLogs.id }).from(emailLogs).where(and(eq(emailLogs.template, "sales_follow_ups"), eq(emailLogs.toEmail, first.email), gt(emailLogs.createdAt, new Date(now.getTime() - 20 * H))));
    if (already) continue;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: first.tz || "Europe/Brussels" }).format(now);
    const mail = emails.salesFollowUps({ businessName: first.biz, name: firstName(first.name), items: list.slice(0, 30).map((r) => ({ title: r.title, detail: [r.what, r.company].filter(Boolean).join(" · "), late: !!r.next && r.next < today })), more: Math.max(0, list.length - 30), url: `${(process.env.SKYDEV_APP_URL ?? appUrl()).replace(/\/$/, "")}/app/ventes/relances?moi=1` });
    if (await sendEmail({ to: first.email, ...mail, template: "sales_follow_ups", businessId: first.businessId })) sent++;
  }
  return sent;
}

/**
 * App Avis Google : quelques heures après chaque rendez-vous terminé, demande d'avis au client
 * (une seule fois par rendez-vous, et pas plus d'une par client sur la période choisie).
 */
export async function sendAutoReviewRequests(now = new Date()) {
  const at = sql`${now.toISOString()}::timestamptz`;
  // Espaces en lecture seule : exclus de la sélection (ils ne prennent pas la place des autres).
  const auto = await db.select({ id: reviewSettings.businessId }).from(reviewSettings).where(eq(reviewSettings.autoSend, true));
  const locked: string[] = [];
  for (const { id } of auto) if (await isLocked(id)) locked.push(id);
  const rows = await db
    .select({ id: appointments.id, businessId: appointments.businessId, email: appointments.contactEmail, name: appointments.contactName, customerId: appointments.customerId, minDays: reviewSettings.minDaysBetween })
    .from(appointments)
    .innerJoin(reviewSettings, eq(reviewSettings.businessId, appointments.businessId))
    .innerJoin(businesses, eq(businesses.id, appointments.businessId))
    .where(
      and(
        eq(reviewSettings.autoSend, true),
        isNotNull(reviewSettings.googleUrl),
        locked.length ? notInArray(appointments.businessId, locked) : undefined,
        isNull(businesses.deletedAt),
        eq(appointments.kind, "appointment"),
        eq(appointments.status, "confirmed"),
        eq(appointments.noShow, false),
        isNotNull(appointments.contactEmail),
        sql`${appointments.endsAt} <= ${at} - make_interval(hours => ${reviewSettings.delayHours})`,
        sql`${appointments.endsAt} > ${at} - make_interval(hours => ${reviewSettings.delayHours} + 24)`,
        sql`not exists (select 1 from review_requests rr where rr.appointment_id = ${appointments.id})`,
        sql`not exists (select 1 from review_requests rr where rr.business_id = ${appointments.businessId} and lower(rr.email) = lower(${appointments.contactEmail}) and rr.created_at > ${at} - make_interval(days => ${reviewSettings.minDaysBetween}))`,
      ),
    )
    .limit(300);
  let sent = 0;
  const seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.businessId}:${r.email!.toLowerCase()}`;
    if (seen.has(key) || (await isLocked(r.businessId))) continue;
    seen.add(key);
    if (await deliverReviewRequest(r.businessId, { email: r.email!, name: r.name, customerId: r.customerId, appointmentId: r.id }).catch((e) => (console.error("[cron] avis :", e), false))) sent++;
  }
  return sent;
}

/** App Stock : un email au responsable quand des produits passent sous leur seuil (une fois, jusqu'au réassort). */
export async function sendLowStockAlerts() {
  const rows = await db
    .select({ id: products.id, name: products.name, qty: products.stockQty, min: products.minQty, businessId: products.businessId, biz: businesses.name, email: users.email })
    .from(products)
    .innerJoin(businesses, eq(businesses.id, products.businessId))
    .innerJoin(members, and(eq(members.businessId, products.businessId), eq(members.isOwner, true), eq(members.status, "active"), eq(members.isActive, true)))
    .innerJoin(users, eq(users.id, members.userId))
    .where(and(eq(products.active, true), eq(products.trackStock, true), isNotNull(products.minQty), sql`"products"."stock_qty" <= "products"."min_qty"`, isNull(products.lowNotifiedAt), isNull(businesses.deletedAt)))
    .limit(2000);
  const byBiz = new Map<string, typeof rows>();
  for (const r of rows) byBiz.set(r.businessId, [...(byBiz.get(r.businessId) ?? []), r]);
  let sent = 0;
  for (const all of byBiz.values()) {
    // Plusieurs titulaires : un seul email, chaque produit une seule fois.
    const f = all[0]!;
    const list = all.filter((r, i) => all.findIndex((x) => x.id === r.id) === i && r.email === f.email);
    const mail = emails.lowStock({ businessName: f.biz, items: list.slice(0, 40).map((r) => ({ name: r.name, qty: r.qty, min: r.min ?? 0 })), more: Math.max(0, list.length - 40), url: `${(process.env.SKYDEV_APP_URL ?? appUrl()).replace(/\/$/, "")}/app/stock` });
    if (await sendEmail({ to: f.email, ...mail, template: "low_stock", businessId: f.businessId })) {
      sent++;
      await db.update(products).set({ lowNotifiedAt: new Date() }).where(inArray(products.id, list.map((r) => r.id)));
    }
  }
  return sent;
}
