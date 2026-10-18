/* eslint-disable @typescript-eslint/no-explicit-any -- les documents de l'ancienne base n'ont pas de type fiable */
/**
 * Migration de l'ancien Branshee (MongoDB) vers Branshee v2 (PostgreSQL).
 *
 * Principe : on COPIE, on ne supprime rien dans MongoDB. Tout se fait dans UNE transaction :
 * si une seule erreur survient, rien n'est écrit dans PostgreSQL.
 *
 * Usage (sur le VPS) :
 *   MONGO_URI=... DATABASE_URL=... DATA_ENCRYPTION_KEY=... npx tsx scripts/migrate-from-mongo.ts --dry-run
 *   MONGO_URI=... DATABASE_URL=... DATA_ENCRYPTION_KEY=... npx tsx scripts/migrate-from-mongo.ts
 *
 * Options :
 *   --dry-run          tout est calculé et inséré puis annulé : seul le rapport est produit
 *   --json <dossier>   lit des exports `mongoexport --jsonArray` (<collection>.json) au lieu de MONGO_URI
 *   --force            supprime d'abord les données d'une migration précédente (lignes avec legacy_id)
 *   --report <fichier> écrit le rapport JSON (par défaut migration-report.json)
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { TZDate } from "@date-fns/tz";
import { drizzle } from "drizzle-orm/postgres-js";
import { isNotNull, sql } from "drizzle-orm";
import postgres from "postgres";
import * as s from "../src/db/schema";
import { resolveTheme } from "../src/lib/booking-theme";
import { encrypt } from "../src/lib/field-crypto";
import { BUILT_IN_GRADES, NO_PERMISSIONS, type Permissions } from "../src/lib/permissions";
import { slugify } from "../src/lib/slug";

type Doc = Record<string, any>;
const TZ = "Europe/Brussels";
const COLLECTIONS = [
  "users", "clients", "companies", "companygrades", "companymemberships", "employees", "daysoffs", "services", "forms",
  "clientdossiers", "bookings", "reviews", "reviewreports", "sites", "promocodes", "accesslinks", "articles",
  "featureflags", "jobtitles", "supportchats", "supportratings", "supportcontents", "adminmessages", "activitylogs",
] as const;
type Collection = (typeof COLLECTIONS)[number];

// ─── Arguments ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const DRY_RUN = flag("--dry-run");
const FORCE = flag("--force");
const JSON_DIR = option("--json");
const REPORT_FILE = option("--report") ?? "migration-report.json";

// ─── Rapport ──────────────────────────────────────────────────────────────────
const report = {
  startedAt: new Date().toISOString(),
  dryRun: DRY_RUN,
  source: JSON_DIR ? `json:${JSON_DIR}` : "mongodb",
  read: {} as Record<string, number>,
  written: {} as Record<string, number>,
  warnings: [] as string[],
};
const count = (table: string, n = 1) => (report.written[table] = (report.written[table] ?? 0) + n);
const warn = (msg: string) => {
  if (report.warnings.length < 2000) report.warnings.push(msg);
};

// ─── Lecture de la source ─────────────────────────────────────────────────────
/** Convertit le JSON étendu de mongoexport ({$oid}, {$date}, {$numberLong}) en valeurs simples. */
function normalize(v: any): any {
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === "object") {
    if ("$oid" in v) return String(v.$oid);
    if ("$date" in v) return new Date(typeof v.$date === "object" && "$numberLong" in v.$date ? Number(v.$date.$numberLong) : v.$date);
    if ("$numberLong" in v || "$numberInt" in v || "$numberDouble" in v) return Number(v.$numberLong ?? v.$numberInt ?? v.$numberDouble);
    if (v._bsontype === "ObjectId" || v._bsontype === "ObjectID") return v.toHexString();
    if (v instanceof Date) return v;
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalize(x)]));
  }
  return v;
}

async function loadSource(): Promise<Record<Collection, Doc[]>> {
  const data = {} as Record<Collection, Doc[]>;
  if (JSON_DIR) {
    for (const c of COLLECTIONS) {
      const file = path.join(JSON_DIR, `${c}.json`);
      data[c] = existsSync(file) ? normalize(JSON.parse(readFileSync(file, "utf8"))) : [];
    }
    return data;
  }
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI manquant (ou utilisez --json <dossier>).");
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const mdb = client.db();
    for (const c of COLLECTIONS) data[c] = normalize(await mdb.collection(c).find({}).toArray());
  } finally {
    await client.close();
  }
  return data;
}

// ─── Utilitaires de conversion ────────────────────────────────────────────────
const id = (v: any): string | null => (v == null ? null : String(v));
const text = (v: any): string | null => {
  const t = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
  return t ? t : null;
};
const lower = (v: any) => text(v)?.toLowerCase() ?? null;
const date = (v: any): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const DEFAULT_AVATAR = /no-user\.webp$/;
const image = (v: any) => (text(v) && !DEFAULT_AVATAR.test(v) ? text(v) : null);
/** Carte Google Maps : l'ancien champ contenait l'URL ou tout le code <iframe>. On ne garde qu'une URL d'intégration Google. */
const mapSrc = (v: string | null): string | null => {
  if (!v) return null;
  const src = (v.match(/src\s*=\s*["']([^"']+)["']/i)?.[1] ?? v).replace(/&amp;/g, "&");
  try {
    const u = new URL(src);
    return u.protocol === "https:" && /^(www\.)?google\.[a-z.]+$/.test(u.hostname) && u.pathname.startsWith("/maps/embed") ? u.toString() : null;
  } catch {
    return null;
  }
};
const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const hhmm = (v: any): string | null => {
  const m = typeof v === "string" ? v.trim().match(HHMM) : null;
  return m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : null;
};
/** Les dates de RDV étaient stockées à minuit UTC ("2026-10-19" → 2026-10-19T00:00:00Z). */
const dayOf = (v: any): string | null => date(v)?.toISOString().slice(0, 10) ?? null;
function instant(day: string, time: string, tz: string) {
  const [y, mo, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(new TZDate(y, mo - 1, d, Number(time.slice(0, 2)), Number(time.slice(3, 5)), 0, tz).getTime());
}
function ranges(list: any): { start: string; end: string }[] {
  return (Array.isArray(list) ? list : [])
    .map((r) => ({ start: hhmm(r?.start), end: hhmm(r?.end) }))
    .filter((r): r is { start: string; end: string } => !!r.start && !!r.end && r.start < r.end);
}
/** Clé d'identité d'un client, identique à l'ancien `dossierKey` : email, sinon téléphone, sinon nom. */
function clientKey(c: { email?: any; phone?: any; fullName?: any; firstName?: any; lastName?: any }) {
  const email = lower(c.email);
  if (email) return "mail:" + email;
  const tel = String(c.phone ?? "").replace(/\D/g, "");
  if (tel) return "tel:" + tel;
  const name = (text(c.fullName) ?? `${c.firstName ?? ""} ${c.lastName ?? ""}`).trim().replace(/\s+/g, " ").toLowerCase();
  return name ? "nom:" + name : "";
}
const PLAN: Record<string, "free" | "pro" | "pro_plus"> = { basic: "free", essentiel: "free", "": "free", pro: "pro", premium: "pro", business: "pro_plus" };

/** Anciennes clés de permissions → nouvelles (cf. src/lib/permissions.ts). */
function convertPermissions(old: any): Permissions {
  const p = structuredClone(NO_PERMISSIONS) as Record<string, Record<string, boolean>>;
  const o = old ?? {};
  const b = (v: any) => v === true;
  p.appointments = { view: b(o.appointments?.view), manage: b(o.appointments?.manage), cancel: b(o.appointments?.cancelDelete) };
  p.customers = { view: b(o.clients?.view), manage: b(o.clients?.manage) };
  p.services = { view: b(o.services?.view), manage: b(o.services?.manage) };
  p.groupSessions = { view: b(o.groupSessions?.view), manage: b(o.groupSessions?.manage) };
  p.availability = {
    manageShared: b(o.availability?.manageShared),
    manageOwnSchedule: b(o.availability?.manageOwnSchedule),
    manageOthersSchedule: b(o.availability?.manageOthersSchedule),
    manageOwnTimeOff: b(o.availability?.manageOwnTimeOff),
    manageOthersTimeOff: b(o.availability?.manageOthersTimeOff),
  };
  p.forms = { manage: b(o.forms?.manage) };
  p.customization = { manage: b(o.customization?.manage) };
  p.settings = { manage: b(o.settings?.manage) };
  p.team = { view: b(o.collaborators?.view), manage: b(o.collaborators?.manage) };
  p.grades = { view: b(o.grades?.view), manage: b(o.grades?.manage) };
  p.logs = { view: b(o.logs?.view) };
  p.billing = { manage: b(o.billing?.manage) };
  p.business = { manage: b(o.establishment?.manage), delete: b(o.establishment?.delete) };
  return p as Permissions;
}

async function insertMany<T>(tx: any, table: any, rows: T[], name: string) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    if (chunk.length) await tx.insert(table).values(chunk);
  }
  count(name, rows.length);
}

// ─── Migration ────────────────────────────────────────────────────────────────
class DryRunRollback extends Error {}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquant.");
  encrypt("test"); // vérifie DATA_ENCRYPTION_KEY avant de commencer

  const src = await loadSource();
  for (const c of COLLECTIONS) report.read[c] = src[c].length;
  console.log("Lu :", report.read);

  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(client, { schema: s, casing: "snake_case" });

  try {
    await db.transaction(async (tx) => {
      // Données d'une migration précédente ?
      const [{ n }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(s.businesses).where(isNotNull(s.businesses.legacyId))) as [{ n: number }];
      if (n > 0) {
        if (!FORCE) throw new Error(`La base contient déjà ${n} établissement(s) migré(s). Relancez avec --force pour les remplacer.`);
        await tx.delete(s.businesses).where(isNotNull(s.businesses.legacyId));
        await tx.delete(s.users).where(isNotNull(s.users.legacyId));
        await tx.delete(s.articles).where(isNotNull(s.articles.legacyId));
        await tx.delete(s.promoCodes).where(isNotNull(s.promoCodes.legacyId));
        console.log("Migration précédente supprimée (--force).");
      }

      // ── 1. Comptes ──────────────────────────────────────────────────────
      const userByLegacy = new Map<string, string>(); // ancien _id (User ou Client) → users.id
      const userByEmail = new Map<string, string>();
      const userDocById = new Map<string, Doc>();
      const userRows: (typeof s.users.$inferInsert)[] = [];

      for (const u of src.users) {
        const email = lower(u.email);
        if (!email) {
          warn(`Utilisateur ${u._id} sans email : ignoré.`);
          continue;
        }
        if (userByEmail.has(email)) {
          warn(`Email en double chez les pros (${email}) : ${u._id} rattaché au premier compte.`);
          userByLegacy.set(id(u._id)!, userByEmail.get(email)!);
          continue;
        }
        const newId = randomUUID();
        userByLegacy.set(id(u._id)!, newId);
        userByEmail.set(email, newId);
        userDocById.set(id(u._id)!, u);
        userRows.push({
          id: newId,
          email,
          fullName: text(u.fullName) ?? email,
          passwordHash: text(u.password),
          googleId: text(u.googleId),
          appleId: text(u.appleId),
          avatarUrl: image(u.profilePicture),
          phone: text(u.phone),
          locale: ["fr", "en", "nl", "de", "es", "it"].includes(u.preferredLang) ? u.preferredLang : "fr",
          address: text(u.address),
          postalCode: text(u.postalCode),
          city: text(u.city),
          country: text(u.country),
          disabledAt: u.isDisabled ? (date(u.updatedAt) ?? new Date()) : null,
          lastLoginAt: date(u.lastLoginAt),
          referralCode: text(u.referralCode),
          signupIntent: u.accountIntent === "client" ? "client" : u.accountIntent === "pro" ? "pro" : null,
          // Relances déjà envoyées par l'ancien Branshee : on ne les renvoie pas.
          nudges: { ...(Number(u.onboarding?.nudgeStage) > 0 ? { onboardingStage: Math.min(2, Number(u.onboarding.nudgeStage)) } : {}), ...(u.onboarding?.createEstabNudged ? { createBusinessAt: (date(u.updatedAt) ?? new Date()).toISOString() } : {}) },
          acquisition: u.acquisition && Object.values(u.acquisition).some(Boolean) ? { ...u.acquisition, capturedAt: date(u.acquisition.capturedAt)?.toISOString() } : null,
          // Double authentification : même secret base32 (Google Authenticator), désormais chiffré en base.
          twoFactorSecret: u.twoFA?.enabled && /^[A-Z2-7]{16,}=*$/.test(String(u.twoFA.secret ?? "")) ? encrypt(String(u.twoFA.secret)) : null,
          legacyId: id(u._id),
          createdAt: date(u.createdAt) ?? new Date(),
        });
      }

      // Clients finaux : fusion sur l'email avec les comptes pros.
      for (const c of src.clients) {
        const email = lower(c.email);
        if (!email) continue;
        const existing = userByEmail.get(email);
        if (existing) {
          userByLegacy.set(id(c._id)!, existing);
          continue;
        }
        const newId = randomUUID();
        userByLegacy.set(id(c._id)!, newId);
        userByEmail.set(email, newId);
        userRows.push({
          id: newId,
          email,
          fullName: text(c.fullName) ?? email,
          passwordHash: text(c.password),
          googleId: text(c.googleId),
          avatarUrl: image(c.profilePicture),
          phone: text(c.phone),
          locale: ["fr", "en", "nl", "de", "es", "it"].includes(c.preferredLang) ? c.preferredLang : "fr",
          address: text(c.address),
          postalCode: text(c.postalCode),
          city: text(c.city),
          country: text(c.country),
          emailNotifications: c.emailNotifications !== false,
          legacyId: id(c._id),
          createdAt: date(c.createdAt) ?? new Date(),
        });
      }
      // Les codes de parrainage en double sont neutralisés (contrainte d'unicité).
      const seenRef = new Set<string>();
      for (const r of userRows) {
        if (r.referralCode && seenRef.has(r.referralCode)) r.referralCode = null;
        else if (r.referralCode) seenRef.add(r.referralCode);
      }
      await insertMany(tx, s.users, userRows, "users");

      // Parrains, abonnements, crédit SMS, Google Agenda
      const subs: (typeof s.subscriptions.$inferInsert)[] = [];
      const wallets: (typeof s.smsWallets.$inferInsert)[] = [];
      const gcals: (typeof s.googleCalendarConnections.$inferInsert)[] = [];
      for (const [legacy, u] of userDocById) {
        const uid = userByLegacy.get(legacy)!;
        if (u.referredBy && userByLegacy.get(id(u.referredBy)!)) {
          await tx.update(s.users).set({ referredById: userByLegacy.get(id(u.referredBy)!)!, referralPaidAt: u.referralPaidCounted ? (date(u.updatedAt) ?? new Date()) : null }).where(sql`${s.users.id} = ${uid}`);
        }
        if (u.referral?.creditMonths) await tx.insert(s.referralCredits).values({ userId: uid, monthsClaimed: Number(u.referral.creditMonths) || 0 }).onConflictDoNothing();
        const sub = u.subscription ?? {};
        const granted = (u.manualPremium || u.isPremium) && u.manualPremiumExpiry ? date(u.manualPremiumExpiry) : null;
        const plan = PLAN[sub.plan ?? ""] ?? "free";
        if (plan !== "free" || granted || sub.stripeCustomerId) {
          subs.push({
            userId: uid,
            plan: granted && plan === "free" ? "pro" : plan,
            status: sub.status === "active" ? "active" : sub.status === "cancelled" ? "cancelled" : granted ? "active" : "expired",
            stripeCustomerId: text(sub.stripeCustomerId),
            stripeSubscriptionId: text(sub.stripeSubscriptionId),
            grantedUntil: granted,
            extraSeats: Number(u.addons?.extraCollaboratorSeats ?? 0) || 0,
          });
        }
        if (Number(u.smsBalanceCents) > 0 || u.smsAutoRecharge?.enabled) {
          wallets.push({
            userId: uid,
            balanceCents: Number(u.smsBalanceCents) || 0,
            autoRecharge: { enabled: !!u.smsAutoRecharge?.enabled, thresholdCents: Number(u.smsAutoRecharge?.thresholdCents ?? 500), amountCents: Number(u.smsAutoRecharge?.amountCents ?? 2000) },
            monthKey: text(u.smsUsage?.monthKey),
            monthCount: Number(u.smsUsage?.count ?? 0) || 0,
          });
        }
        if (u.googleCalendar?.connected && text(u.googleCalendar.refreshToken)) {
          gcals.push({ userId: uid, googleEmail: text(u.googleCalendar.email) ?? "", refreshTokenEnc: encrypt(u.googleCalendar.refreshToken)!, scope: text(u.googleCalendar.scope) });
        }
      }
      const seenStripe = new Set<string>();
      for (const sb of subs) {
        for (const k of ["stripeCustomerId", "stripeSubscriptionId"] as const) {
          const v = sb[k];
          if (v && seenStripe.has(k + v)) {
            warn(`Identifiant Stripe en double (${v}) : ignoré pour un des comptes.`);
            sb[k] = null;
          } else if (v) seenStripe.add(k + v);
        }
      }
      await insertMany(tx, s.subscriptions, subs, "subscriptions");
      await insertMany(tx, s.smsWallets, wallets, "sms_wallets");
      await insertMany(tx, s.googleCalendarConnections, gcals, "google_calendar_connections");

      // ── 2. Établissements ───────────────────────────────────────────────
      type Biz = { id: string; tz: string; ownerUser: Doc | undefined; ownerMemberId: string; scheduleMode: "shared" | "per_member"; slotTime: number; slug: string };
      const bizByLegacy = new Map<string, Biz>(); // Company._id → établissement
      const usedSlugs = new Set<string>();
      const memberByUser = new Map<string, string>(); // `${companyId}:${userLegacyId}` → members.id
      const memberByEmployee = new Map<string, string>(); // Employee._id → members.id
      const categoryByName = new Map<string, string>(); // `${companyId}:${nom en minuscules}` → service_categories.id

      for (const c of src.companies) {
        if (c.isDeleted) {
          warn(`Établissement ${c._id} (« ${c.name} ») supprimé dans l'ancienne base : ignoré.`);
          continue;
        }
        const ownerId = userByLegacy.get(id(c.owner) ?? "");
        if (!ownerId) {
          warn(`Établissement ${c._id} sans propriétaire valide : ignoré.`);
          continue;
        }
        const owner = userDocById.get(id(c.owner)!);
        const cal = owner?.calendarSettings ?? {};
        const loc = c.location && typeof c.location === "object" ? c.location : owner?.location ?? {};

        let slug = slugify(text(c.slug) ?? text(c.name) ?? text(owner?.businessName) ?? "etablissement") || "etablissement";
        if (usedSlugs.has(slug)) {
          let i = 2;
          while (usedSlugs.has(`${slug}-${i}`)) i++;
          warn(`Adresse « ${slug} » en double : renommée en « ${slug}-${i} ».`);
          slug = `${slug}-${i}`;
        }
        usedSlugs.add(slug);

        const bizId = randomUUID();
        const scheduleMode = c.scheduleMode === "perEmployee" ? "per_member" : "shared";
        await tx.insert(s.businesses).values({
          id: bizId,
          ownerId,
          name: text(c.name) ?? text(owner?.businessName) ?? "Mon établissement",
          slug,
          businessType: text(c.businessType) ?? text(owner?.businessType),
          photoUrl: image(c.photo) ?? image(owner?.businessPicture),
          description: text(c.description) ?? text(owner?.description),
          aboutHtml: text(c.aboutHtml) ?? text(owner?.aboutHtml),
          email: text(c.emailPro) ?? text(owner?.emailPro),
          phone: text(c.phonePro) ?? text(owner?.phonePro),
          website: text(c.website) ?? text(owner?.website),
          social: {
            instagram: text(c.instagramLink) ?? text(owner?.instagramLink) ?? undefined,
            facebook: text(c.facebookLink) ?? text(owner?.facebookLink) ?? undefined,
            whatsapp: text(c.whatsappLink) ?? text(owner?.whatsappLink) ?? undefined,
          },
          locationMode: loc.serviceType === "en_ligne" ? "online" : loc.serviceType === "iframe" ? "embed" : "on_site",
          address: text(loc.address),
          postalCode: text(loc.zip),
          city: text(loc.city),
          country: text(loc.country) ?? text(loc.onlineCountry),
          latitude: Number(loc.lat) || null,
          longitude: Number(loc.lon) || null,
          mapEmbedUrl: mapSrc(text(loc.iframeUrl) ?? text(loc.iframeEmbedCode)),
          mapsUrl: /^https:\/\//.test(text(loc.gmapUrl) ?? "") ? text(loc.gmapUrl) : null,
          languages: (Array.isArray(loc.onlineLangs) ? loc.onlineLangs : []).filter((l: unknown) => typeof l === "string" && /^[a-z]{2}$/.test(l)),
          timezone: TZ,
          pausedAt: c.isPaused ? (date(c.updatedAt) ?? new Date()) : null,
          boostPosition: Number(c.boostPosition) || 0,
          legacyId: id(c._id),
          createdAt: date(c.createdAt) ?? new Date(),
        });
        count("businesses");

        // Forfait porté par l'établissement (company.plan) ; à défaut, celui du compte reste lu via `subscriptions`.
        const cPlan = PLAN[c.plan ?? ""] ?? "free";
        if (cPlan !== "free" && (!c.planStatus || c.planStatus === "active")) {
          await tx.insert(s.businessPlans).values({
            businessId: bizId,
            plan: cPlan,
            status: "active",
            stripeSubscriptionId: text(c.stripeSubscriptionId),
            grantedUntil: date(c.grantExpiry),
            customUrlAddon: !!owner?.addons?.customUrl,
            extraSeats: Number(owner?.addons?.extraCollaboratorSeats ?? 0) || 0,
          });
          count("business_plans");
        }

        const lead = c.minBookingLeadTime?.enabled ? Number(c.minBookingLeadTime.minutes) || null : null;
        const bq = c.bookingQuestion ?? {};
        await tx.insert(s.bookingSettings).values({
          businessId: bizId,
          scheduleMode,
          slotMode: c.slotMode === "interval" ? "interval" : "fixed",
          slotIntervalMin: Number(c.slotInterval) || Number(c.slotTime) || 30,
          bufferBeforeMin: Number(c.bufferBefore ?? 0) || 0,
          bufferAfterMin: Number(c.bufferAfter ?? c.bufferTime ?? 0) || 0,
          minLeadMin: lead,
          horizonDays: Number(c.bookingHorizonDays) > 0 ? Number(c.bookingHorizonDays) : null,
          autoConfirm: c.autoConfirm !== false,
          waitlistEnabled: !!c.waitlistEnabled,
          allowOverbooking: !!c.allowOverbooking,
          phoneRequired: cal.phoneRequired !== false,
          smartGrouping: { enabled: !!c.smartGrouping?.enabled, windowHours: Number(c.smartGrouping?.windowHours ?? 3), weekdays: Array.isArray(c.smartGrouping?.weekdays) ? c.smartGrouping.weekdays : [] },
          firstVisitQuestion: {
            enabled: !!bq.enabled,
            question: text(bq.question) ?? "Est-ce la première fois que vous nous consultez ?",
            newLabel: text(bq.newLabel) ?? "Oui, je suis nouveau",
            existingLabel: text(bq.existingLabel) ?? "Non, j’ai déjà consulté",
          },
        });
        const ap = c.acceptedPayments ?? {};
        await tx.insert(s.paymentSettings).values({
          businessId: bizId,
          prepaymentEnabled: !!c.prepayment?.enabled,
          prepaymentRequired: !!c.prepayment?.required,
          cancellationRule: ["free", "half_24h", "full_12h"].includes(c.cancellationPolicy?.rule) ? c.cancellationPolicy.rule : "free",
          stripeAccountId: text(c.stripeConnect?.accountId),
          stripeStatus: ["not_connected", "pending", "active"].includes(c.stripeConnect?.status) ? c.stripeConnect.status : "not_connected",
          stripeAccountEmail: text(c.stripeConnect?.accountEmail),
          payout: ["bank_transfer", "paypal", "cash", "other"].includes(c.payoutInfo?.method)
            ? { method: c.payoutInfo.method, iban: text(c.payoutInfo.iban) ?? undefined, bic: text(c.payoutInfo.bic) ?? undefined, paypalEmail: text(c.payoutInfo.paypalEmail) ?? undefined, other: text(c.payoutInfo.other) ?? undefined }
            : {},
          accepted: {
            cash: !!ap.cash,
            cardOnSite: !!ap.cardOnSite,
            bankTransfer: { enabled: !!ap.bankTransfer?.enabled, iban: text(ap.bankTransfer?.iban) ?? undefined, bic: text(ap.bankTransfer?.bic) ?? undefined, bankName: text(ap.bankTransfer?.bankName) ?? undefined, note: text(ap.bankTransfer?.note) ?? undefined },
            paypal: { enabled: !!ap.paypal?.enabled, paypalMe: text(ap.paypal?.paypalMe) ?? undefined },
            qrCode: { enabled: !!ap.qrCode?.enabled, imageUrl: text(ap.qrCode?.imageUrl) ?? undefined, note: text(ap.qrCode?.note) ?? undefined },
          },
        });
        await tx.insert(s.notificationSettings).values({
          businessId: bizId,
          reminderDelayHours: [6, 12, 24, 48, 72].includes(Number(cal.reminderDelayHours)) ? Number(cal.reminderDelayHours) : 24,
          reminderMessage: text(cal.reminderMessage),
          confirmationMessage: text(cal.confirmationMessage),
          cancellationMessage: text(cal.cancellationMessage),
          reminderPaymentMethods: Array.isArray(cal.reminderPaymentMethods) ? cal.reminderPaymentMethods : [],
          reminderPaymentNote: text(cal.reminderPaymentNote),
          emailOwnerOnNewBooking: owner?.notifications?.newBooking !== false,
          emailOwnerOnCancellation: owner?.notifications?.cancellation !== false,
          smsReminders: !!cal.smsRemindersEnabled,
          smsConfirmations: !!cal.smsConfirmationEnabled,
          smsAllowOverage: !!cal.smsAllowOverage,
          whatsappReminders: !!cal.whatsappRemindersEnabled,
          whatsappConfirmations: !!cal.whatsappConfirmationEnabled,
        });
        const sectionMap: Record<string, s.PageSection> = { about: "about", location: "location", hours: "hours", gallery: "gallery", reviews: "reviews", services: "services", team: "team", amenities: "amenities", faq: "faq" };
        const order: string[] = Array.isArray(cal.sectionOrder) ? cal.sectionOrder : ["about", "location", "hours", "gallery", "reviews"];
        const enabled = (k: string) =>
          ({ about: cal.showSectionAbout !== false, location: cal.showSectionMap !== false, hours: cal.showSectionHours !== false, gallery: !!cal.showSectionGallery, reviews: !!cal.showSectionReviews, services: !!cal.showSectionServices, team: !!cal.showSectionTeam, amenities: !!cal.showSectionAmenities, faq: !!cal.showSectionFaq })[k] ?? false;
        await tx.insert(s.bookingPageSettings).values({
          businessId: bizId,
          // Thème complet de l'ancien éditeur ; `resolveTheme` écarte les valeurs invalides champ par champ.
          theme: resolveTheme({
            accentColor: text(cal.accentColor) ?? "#22c55e",
            accentText: text(cal.accentText) ?? "#ffffff",
            pageBg: text(cal.pageBg) ?? "#f3f4f6",
            pageBgImage: cal.pageBgType === "image" ? (image(cal.pageBgImage) ?? undefined) : undefined,
            calBg: text(cal.calBg) ?? undefined,
            dayBg: text(cal.dayBg) ?? undefined,
            daySelectedBg: text(cal.daySelectedBg) ?? undefined,
            daySelectedText: text(cal.daySelectedText) ?? undefined,
            dayHoverBg: text(cal.dayHoverBg) ?? undefined,
            btnHoverBg: text(cal.btnHoverBg) ?? undefined,
            dayAvailableColor: text(cal.dayAvailableColor) ?? undefined,
            dayBusyColor: text(cal.dayBusyColor) ?? undefined,
            dayFullColor: text(cal.dayFullColor) ?? undefined,
            font: text(cal.font) ?? "Inter",
            customFontUrl: text(cal.customFontUrl) ?? undefined,
            customFontFamily: text(cal.customFontFamily) ?? undefined,
            radius: ["none", "sm", "md", "lg"].includes(cal.borderRadius) ? cal.borderRadius : "md",
            borderStyle: ["none", "subtle", "medium", "strong"].includes(cal.borderStyle) ? cal.borderStyle : "subtle",
            shadowStyle: ["none", "subtle", "medium", "strong"].includes(cal.shadowStyle) ? cal.shadowStyle : "subtle",
            layout: cal.layoutStyle === "split" ? "split" : "classic",
            texts: { calendarHelp: text(cal.textCalendarHelp) ?? "", slotHeading: text(cal.textSlotHeading) ?? "", timezone: text(cal.textTimezone) ?? "" },
          }),
          sections: [...new Set([...order, "services", "team", "amenities", "faq"])].filter((k) => sectionMap[k] && enabled(k)).map((k) => sectionMap[k]!),
          showContact: { email: cal.showEmailPro !== false, phone: cal.showPhonePro !== false, instagram: cal.showInstagram !== false, facebook: cal.showFacebook !== false, whatsapp: cal.showWhatsapp !== false, website: cal.showWebsite !== false },
          gallery: Array.isArray(cal.gallery) ? cal.gallery.filter((x: any) => typeof x === "string") : [],
          galleryLayout: cal.galleryLayout === "carousel" ? "carousel" : "grid",
          equipment: Array.isArray(cal.equipment) ? cal.equipment : [],
          amenities: { cleanliness: cal.amenities?.cleanliness ?? [], comfort: cal.amenities?.comfort ?? [], practical: cal.amenities?.practical ?? [] },
          faq: (Array.isArray(cal.faq) ? cal.faq : []).map((f: any) => ({ question: String(f?.question ?? f?.q ?? ""), answer: String(f?.answer ?? f?.a ?? "") })).filter((f: any) => f.question),
          badges: Array.isArray(cal.badges) ? cal.badges : [],
          categoryStyle: ["pills", "accordion", "grid"].includes(c.bookingCategoryStyle) ? c.bookingCategoryStyle : "pills",
          embed: { title: text(cal.embedTitle) ?? undefined, fontUrl: text(cal.embedFontUrl) ?? undefined, fontFamily: text(cal.embedFontFamily) ?? undefined },
        });
        count("business_settings", 4);

        // Catégories
        const cats: { name: string; icon: string | null }[] = (Array.isArray(c.categories) && c.categories.length ? c.categories : cal.categories ?? [])
          .map((x: any) => ({ name: text(x?.name), icon: text(x?.icon) }))
          .filter((x: any) => x.name);
        const seenCat = new Set<string>();
        for (const [i, cat] of cats.entries()) {
          const key = cat.name.toLowerCase();
          if (seenCat.has(key)) continue;
          seenCat.add(key);
          const catId = randomUUID();
          categoryByName.set(`${c._id}:${key}`, catId);
          await tx.insert(s.serviceCategories).values({ id: catId, businessId: bizId, name: cat.name, icon: cat.icon, position: i });
          count("service_categories");
        }

        // Horaires communs
        const shared = (Array.isArray(c.schedule) ? c.schedule : []).flatMap((d: any) =>
          d?.dayOff ? [] : ranges(d?.workingHours).map((r) => ({ businessId: bizId, memberId: null, weekday: Number(d.weekdayIndex), startTime: r.start, endTime: r.end })),
        ).filter((h: any) => h.weekday >= 0 && h.weekday <= 6);
        await insertMany(tx, s.weeklyHours, shared, "weekly_hours");

        // Grades
        const gradeByLegacy = new Map<string, string>();
        const companyGrades = src.companygrades.filter((g) => id(g.company) === id(c._id));
        const gradeRows = (companyGrades.length ? companyGrades.map((g) => ({ legacy: id(g._id), name: text(g.name) ?? "Grade", isBuiltIn: !!g.isBuiltIn, permissions: convertPermissions(g.permissions) })) : BUILT_IN_GRADES.map((g) => ({ legacy: null, name: g.name, isBuiltIn: true, permissions: g.permissions })))
          .map((g) => ({ ...g, id: randomUUID() }));
        const seenGrade = new Set<string>();
        for (const g of gradeRows) {
          let name = g.name;
          while (seenGrade.has(name.toLowerCase())) name += " (2)";
          seenGrade.add(name.toLowerCase());
          if (g.legacy) gradeByLegacy.set(g.legacy, g.id);
          await tx.insert(s.grades).values({ id: g.id, businessId: bizId, name, isBuiltIn: g.isBuiltIn, permissions: g.permissions, legacyId: g.legacy });
          count("grades");
        }

        // Membres : propriétaire, collaborateurs (memberships), anciens employés
        const weekly = (memberId: string, schedule: any) =>
          (Array.isArray(schedule) ? schedule : []).flatMap((d: any) =>
            d?.dayOff ? [] : ranges(d?.workingHours).map((r) => ({ businessId: bizId, memberId, weekday: Number(d.weekdayIndex), startTime: r.start, endTime: r.end })),
          ).filter((h: any) => h.weekday >= 0 && h.weekday <= 6);

        const op = c.ownerEmployeeProfile ?? {};
        const ownerMemberId = randomUUID();
        await tx.insert(s.members).values({
          id: ownerMemberId,
          businessId: bizId,
          userId: ownerId,
          isOwner: true,
          status: "active",
          isBookable: op.isEmployee !== false,
          displayName: text(op.displayName) ?? text(owner?.fullName) ?? "Propriétaire",
          photoUrl: image(op.displayPhoto) ?? image(owner?.profilePicture),
          bio: text(op.description),
          showRole: !!op.showRole,
          customInfo: (op.customInfo ?? []).filter((x: any) => x?.label).map((x: any) => ({ label: String(x.label), value: String(x.value ?? "") })),
          calendarColor: text(owner?.calendarColor),
          calendarFeedToken: text(owner?.calendarFeedToken),
          joinedAt: date(c.createdAt),
        });
        count("members");
        memberByUser.set(`${c._id}:${c.owner}`, ownerMemberId);
        await insertMany(tx, s.weeklyHours, weekly(ownerMemberId, op.schedule), "weekly_hours");

        for (const m of src.companymemberships.filter((x) => id(x.company) === id(c._id))) {
          const uid = userByLegacy.get(id(m.user) ?? "");
          if (!uid) {
            warn(`Collaborateur ${m._id} sans compte valide : ignoré.`);
            continue;
          }
          if (memberByUser.has(`${c._id}:${m.user}`)) continue; // le propriétaire figure parfois aussi en membership
          const mid = randomUUID();
          const u = userDocById.get(id(m.user)!);
          await tx.insert(s.members).values({
            id: mid,
            businessId: bizId,
            userId: uid,
            status: m.status === "accepted" ? "active" : m.status === "rejected" ? "rejected" : "requested",
            gradeId: gradeByLegacy.get(id(m.grade) ?? "") ?? null,
            canManageOwnTimeOff: typeof m.canManageOwnTimeOff === "boolean" ? m.canManageOwnTimeOff : null,
            isActive: m.isActive !== false,
            isBookable: m.isEmployee !== false,
            displayName: text(m.displayName) ?? text(u?.fullName) ?? "Collaborateur",
            photoUrl: image(m.displayPhoto) ?? image(u?.profilePicture),
            bio: text(m.description),
            showRole: !!m.showRole,
            customInfo: (m.customInfo ?? []).filter((x: any) => x?.label).map((x: any) => ({ label: String(x.label), value: String(x.value ?? "") })),
            calendarColor: text(u?.calendarColor),
            joinedAt: date(m.acceptedAt),
            legacyId: id(m._id),
          });
          count("members");
          memberByUser.set(`${c._id}:${m.user}`, mid);
          await insertMany(tx, s.weeklyHours, weekly(mid, m.schedule), "weekly_hours");
        }
        for (const e of src.employees.filter((x) => id(x.company) === id(c._id))) {
          const mid = randomUUID();
          await tx.insert(s.members).values({
            id: mid,
            businessId: bizId,
            status: "active",
            isActive: e.active !== false,
            isBookable: e.active !== false,
            displayName: `${text(e.firstName) ?? ""} ${text(e.lastName) ?? ""}`.trim() || "Employé",
            photoUrl: image(e.profilePicture),
            bio: text(e.description),
            legacyId: id(e._id),
          });
          count("members");
          memberByEmployee.set(id(e._id)!, mid);
        }

        if (scheduleMode === "per_member") {
          const withHours = new Set((await tx.select({ m: s.weeklyHours.memberId }).from(s.weeklyHours).where(sql`${s.weeklyHours.businessId} = ${bizId}`)).map((r: { m: string | null }) => r.m));
          const noHours = (await tx.select({ id: s.members.id, name: s.members.displayName }).from(s.members).where(sql`${s.members.businessId} = ${bizId} and ${s.members.isBookable}`)).filter((m: { id: string }) => !withHours.has(m.id));
          for (const m of noHours) warn(`« ${m.name} » (${slug}) n'a pas d'horaires : il ne sera pas réservable en ligne tant qu'ils ne sont pas définis.`);
        }
        bizByLegacy.set(id(c._id)!, { id: bizId, tz: TZ, ownerUser: owner, ownerMemberId, scheduleMode, slotTime: Number(c.slotTime) || 30, slug });
      }

      // Certains documents pointent vers le propriétaire (User) au lieu de l'établissement.
      const companyOfUser = new Map<string, string>();
      for (const c of src.companies) if (bizByLegacy.has(id(c._id)!)) companyOfUser.set(id(c.owner)!, id(c._id)!);
      for (const u of src.users) if (u.company && bizByLegacy.has(id(u.company)!) && !companyOfUser.has(id(u._id)!)) companyOfUser.set(id(u._id)!, id(u.company)!);
      const resolveCompany = (ref: any): string | null => {
        const r = id(ref);
        if (!r) return null;
        if (bizByLegacy.has(r)) return r;
        return companyOfUser.get(r) ?? null;
      };
      const memberFor = (companyId: string, ref: any): string | null => {
        const r = id(ref);
        if (!r) return null;
        return memberByUser.get(`${companyId}:${r}`) ?? memberByEmployee.get(r) ?? null;
      };

      // ── 3. Congés et fermetures ─────────────────────────────────────────
      const exceptionRows: (typeof s.scheduleExceptions.$inferInsert)[] = [];
      const seenEx = new Set<string>();
      for (const d of src.daysoffs) {
        const cid = resolveCompany(d.company);
        if (!cid) continue;
        const biz = bizByLegacy.get(cid)!;
        for (const entry of d.dates ?? []) {
          const day = dayOf(entry.date);
          if (!day) continue;
          const hours = ranges(entry.workingHours);
          const isClosed = entry.dayOff !== false || hours.length === 0;
          const targets: (string | null)[] = Array.isArray(entry.employees) && entry.employees.length ? entry.employees.map((e: any) => memberFor(cid, e)).filter(Boolean) : [null];
          for (const memberId of targets) {
            const key = `${biz.id}:${memberId}:${day}`;
            if (seenEx.has(key)) continue;
            seenEx.add(key);
            exceptionRows.push({ businessId: biz.id, memberId, date: day, isClosed, hours: isClosed ? [] : hours });
          }
        }
      }
      await insertMany(tx, s.scheduleExceptions, exceptionRows, "schedule_exceptions");

      // ── 4. Prestations, cours collectifs, questionnaire ────────────────
      const serviceByLegacy = new Map<string, string>();
      const groupSessionByKey = new Map<string, string>(); // `${serviceLegacy}:${day}:${HH:MM}` → group_sessions.id
      const optionByLegacy = new Map<string, string>();

      for (const c of src.companies) {
        const biz = bizByLegacy.get(id(c._id)!);
        if (!biz) continue;
        for (const [qi, q] of (c.serviceQuestionnaire?.questions ?? []).entries()) {
          if (!text(q?.question)) continue;
          const qid = randomUUID();
          await tx.insert(s.intakeQuestions).values({ id: qid, businessId: biz.id, question: text(q.question)!, position: qi });
          count("intake_questions");
          for (const [oi, o] of (q.options ?? []).entries()) {
            if (!text(o?.label)) continue;
            const oid = randomUUID();
            if (o._id) optionByLegacy.set(id(o._id)!, oid);
            await tx.insert(s.intakeOptions).values({ id: oid, questionId: qid, label: text(o.label)!, position: oi });
            count("intake_options");
          }
        }
      }

      for (const sv of src.services) {
        const cid = resolveCompany(sv.company);
        if (!cid) {
          warn(`Prestation ${sv._id} sans établissement : ignorée.`);
          continue;
        }
        const biz = bizByLegacy.get(cid)!;
        let categoryId: string | null = null;
        const catName = text(sv.category);
        if (catName) {
          const key = `${cid}:${catName.toLowerCase()}`;
          categoryId = categoryByName.get(key) ?? null;
          if (!categoryId) {
            categoryId = randomUUID();
            categoryByName.set(key, categoryId);
            await tx.insert(s.serviceCategories).values({ id: categoryId, businessId: biz.id, name: catName, position: 99 });
            count("service_categories");
          }
        }
        const durationMin = Math.max(5, Number(sv.duration) || 30);
        const durationMax = Number(sv.durationMax) > durationMin ? Number(sv.durationMax) : null;
        const sid = randomUUID();
        serviceByLegacy.set(id(sv._id)!, sid);
        const fee = sv.cancellationFee?.enabled && Number(sv.cancellationFee.value) > 0;
        await tx.insert(s.services).values({
          id: sid,
          businessId: biz.id,
          categoryId,
          name: text(sv.name) ?? "Prestation",
          description: text(sv.description),
          priceCents: sv.price == null || sv.price === "" ? null : Math.round(Number(sv.price) * 100),
          durationMin,
          durationMaxMin: durationMax,
          kind: sv.type === "group" ? "group" : "individual",
          capacity: Number(sv.capacity) || null,
          color: /^#[0-9a-f]{6}$/i.test(sv.color ?? "") ? sv.color : null,
          imageUrl: image(sv.image),
          location: text(sv.location),
          position: Number(sv.order) || 0,
          isActive: sv.active !== false,
          audience: ["all", "new", "existing"].includes(sv.answerVisibility) ? sv.answerVisibility : "all",
          cancellationFeeType: fee ? (sv.cancellationFee.type === "amount" ? "amount" : "percent") : null,
          cancellationFeeValue: fee ? Math.round(Number(sv.cancellationFee.value) * (sv.cancellationFee.type === "amount" ? 100 : 1)) : null,
          recurrence: sv.recurring?.enabled && hhmm(sv.recurring.startTime) ? { weekdays: (sv.recurring.weekdays ?? []).map(Number), startTime: hhmm(sv.recurring.startTime)! } : null,
          blocksIndividual: sv.blocksIndividualBookings !== false,
          legacyId: id(sv._id),
          createdAt: date(sv.createdAt) ?? new Date(),
        });
        count("services");

        const memberIds = [...new Set((sv.employees ?? []).map((e: any) => memberFor(cid, e)).filter(Boolean) as string[])];
        await insertMany(tx, s.serviceMembers, memberIds.map((memberId) => ({ serviceId: sid, memberId })), "service_members");

        for (const sess of sv.sessions ?? []) {
          const day = dayOf(sess.date);
          const start = hhmm(sess.startTime);
          const end = hhmm(sess.endTime);
          if (!day || !start || !end || end <= start) continue;
          const gid = randomUUID();
          groupSessionByKey.set(`${sv._id}:${day}:${start}`, gid);
          await tx.insert(s.groupSessions).values({ id: gid, serviceId: sid, startsAt: instant(day, start, biz.tz), endsAt: instant(day, end, biz.tz), capacity: Number(sv.capacity) || null });
          count("group_sessions");
        }
        const rules = (sv.questionRules ?? []).flatMap((r: any) => (r.optionIds ?? []).map((o: any) => optionByLegacy.get(id(o)!)).filter(Boolean));
        await insertMany(tx, s.serviceIntakeRules, [...new Set(rules as string[])].map((optionId) => ({ serviceId: sid, optionId })), "service_intake_rules");
      }

      // Formulaires de réservation (uniquement s'ils étaient actifs)
      for (const f of src.forms) {
        const cid = resolveCompany(f.company);
        if (!cid || !f.active) continue;
        const biz = bizByLegacy.get(cid)!;
        const rows = (f.questions ?? [])
          .filter((q: any) => text(q?.label))
          .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
          .map((q: any, i: number) => ({ businessId: biz.id, label: text(q.label)!, type: ["text", "choice", "yes_no"].includes(q.type) ? q.type : "text", isRequired: !!q.required, options: (q.options ?? []).map(String), position: i }));
        await insertMany(tx, s.formQuestions, rows, "form_questions");
      }

      // ── 5. Clients et dossiers ──────────────────────────────────────────
      const customerByKey = new Map<string, string>(); // `${companyId}:${clé}` → customers.id
      const customerByLegacyRef = new Map<string, string>(); // `${companyId}:${Client._id}` → customers.id
      for (const d of src.clientdossiers) {
        const cid = resolveCompany(d.company);
        if (!cid) continue;
        const biz = bizByLegacy.get(cid)!;
        const key = text(d.clientKey) ?? clientKey(d);
        if (!key || customerByKey.has(`${cid}:${key}`)) continue;
        const custId = randomUUID();
        customerByKey.set(`${cid}:${key}`, custId);
        if (d.clientRef) customerByLegacyRef.set(`${cid}:${d.clientRef}`, custId);
        const fullName = text(d.fullName) ?? (`${text(d.firstName) ?? ""} ${text(d.lastName) ?? ""}`.trim() || text(d.email) || text(d.phone) || "Client");
        await tx.insert(s.customers).values({
          id: custId,
          businessId: biz.id,
          userId: d.clientRef ? (userByLegacy.get(id(d.clientRef)!) ?? null) : null,
          firstName: text(d.firstName),
          lastName: text(d.lastName),
          fullName,
          email: lower(d.email),
          phone: text(d.phone),
          altName: text(d.altName),
          altEmail: lower(d.altEmail),
          altPhone: text(d.altPhone),
          generalInfoEnc: encrypt(text(d.generalInfo)),
          createdManually: !!d.createdManually,
          blockedAt: d.blocked ? (date(d.blockedAt) ?? new Date()) : null,
          blockedReason: text(d.blockedReason),
          legacyId: id(d._id),
          createdAt: date(d.createdAt) ?? new Date(),
        });
        count("customers");
        const notes = (d.entries ?? []).map((e: any) => ({
          customerId: custId,
          date: dayOf(e.date) ?? dayOf(d.createdAt) ?? new Date().toISOString().slice(0, 10),
          title: text(e.title),
          noteEnc: encrypt(text(e.note)),
          todoEnc: encrypt(text(e.todo)),
          attachmentPath: text(e.attachment?.path),
          attachmentName: text(e.attachment?.filename),
          attachmentSize: Number(e.attachment?.size) || null,
        }));
        await insertMany(tx, s.customerNotes, notes, "customer_notes");
      }

      // ── 6. Rendez-vous ──────────────────────────────────────────────────
      let overlaps = 0;
      for (const bk of src.bookings) {
        const cid = resolveCompany(bk.company);
        if (!cid) {
          warn(`RDV ${bk._id} : établissement introuvable, ignoré.`);
          continue;
        }
        const biz = bizByLegacy.get(cid)!;
        const day = dayOf(bk.date);
        const start = hhmm(bk.startTime);
        if (!day || !start) {
          warn(`RDV ${bk._id} : date ou heure invalide (${dayOf(bk.date) ?? bk.date} ${bk.startTime}), ignoré.`);
          continue;
        }
        let end = hhmm(bk.endTime);
        if (!end || end <= start) end = null;
        const startsAt = instant(day, start, biz.tz);
        const endsAt = end ? instant(day, end, biz.tz) : new Date(startsAt.getTime() + (Number(bk.slotTime) || biz.slotTime) * 60000);
        if (!end && !bk.isBlock) warn(`RDV ${bk._id} : heure de fin manquante, durée par défaut appliquée.`);

        // Client : fiche existante (dossier) ou nouvelle fiche créée depuis les coordonnées du RDV
        let customerId: string | null = null;
        if (!bk.isBlock) {
          const fullName = `${text(bk.name) ?? ""} ${text(bk.surname) ?? ""}`.trim();
          const key = clientKey({ email: bk.email, phone: bk.phone, fullName });
          customerId = (bk.clientRef && customerByLegacyRef.get(`${cid}:${bk.clientRef}`)) || (key ? customerByKey.get(`${cid}:${key}`) : undefined) || null;
          if (!customerId && key) {
            customerId = randomUUID();
            customerByKey.set(`${cid}:${key}`, customerId);
            await tx.insert(s.customers).values({
              id: customerId,
              businessId: biz.id,
              userId: bk.clientRef ? (userByLegacy.get(id(bk.clientRef)!) ?? null) : bk.user ? (userByLegacy.get(id(bk.user)!) ?? null) : null,
              firstName: text(bk.name),
              lastName: text(bk.surname),
              fullName: fullName || text(bk.email) || text(bk.phone) || "Client",
              email: lower(bk.email),
              phone: text(bk.phone),
              createdAt: date(bk.createdAt) ?? new Date(),
            }).onConflictDoNothing();
            count("customers");
          }
        }

        const status = bk.status === "canceled" ? "cancelled" : bk.status === "pending" ? "pending" : "confirmed";
        const memberId = memberFor(cid, bk.employee) ?? biz.ownerMemberId;
        let groupSessionId = bk.isGroup && bk.service ? (groupSessionByKey.get(`${bk.service}:${day}:${start}`) ?? null) : null;
        // Cours récurrent de l'ancien Branshee : les séances n'existaient pas en base, on crée celle de cette inscription.
        const groupServiceId = bk.isGroup && bk.service ? serviceByLegacy.get(id(bk.service)!) : undefined;
        if (bk.isGroup && !groupSessionId && groupServiceId) {
          groupSessionId = randomUUID();
          groupSessionByKey.set(`${bk.service}:${day}:${start}`, groupSessionId);
          await tx.insert(s.groupSessions).values({ id: groupSessionId, serviceId: groupServiceId, memberId: memberFor(cid, bk.employee) ?? null, startsAt, endsAt, capacity: null });
          count("group_sessions");
        }
        if (bk.isGroup && !groupSessionId) warn(`RDV ${bk._id} : séance collective introuvable, migré comme RDV individuel en surréservation.`);
        const token = /^[a-f0-9]{64}$/.test(bk.cancelToken ?? "") ? bk.cancelToken : undefined;
        const values: typeof s.appointments.$inferInsert = {
          businessId: biz.id,
          kind: bk.isBlock ? "block" : "appointment",
          status,
          startsAt,
          endsAt,
          memberId,
          serviceId: bk.service ? (serviceByLegacy.get(id(bk.service)!) ?? null) : null,
          groupSessionId,
          customerId,
          serviceName: text(bk.serviceName),
          serviceColor: /^#[0-9a-f]{6}$/i.test(bk.serviceColor ?? "") ? bk.serviceColor : null,
          contactName: `${text(bk.name) ?? ""} ${text(bk.surname) ?? ""}`.trim() || null,
          contactEmail: lower(bk.email),
          contactPhone: text(bk.phone),
          customerMessage: text(bk.message),
          formAnswers: (bk.formAnswers ?? []).filter((a: any) => a?.question).map((a: any) => ({ question: String(a.question), answer: String(a.answer ?? "") })),
          internalNote: text(bk.adminNotes),
          overbooked: !!bk.overbooked || (!!bk.isGroup && !groupSessionId),
          noShow: !!bk.noShow,
          noShowReason: bk.noShowReason === "valid" ? "justified" : bk.noShowReason === "invalid" ? "unjustified" : null,
          ...(token ? { manageToken: token } : {}),
          reminderSentAt: bk.reminderSent ? startsAt : null,
          manualReminderSentAt: bk.manualReminderSent ? startsAt : null,
          cancelledAt: status === "cancelled" ? (date(bk.updatedAt) ?? startsAt) : null,
          googleEventId: text(bk.googleEventId),
          legacyId: id(bk._id),
          createdAt: date(bk.createdAt) ?? new Date(),
        };

        // Les chevauchements tolérés par l'ancienne base sont conservés, marqués « surréservation ».
        let apptId: string;
        try {
          apptId = await tx.transaction(async (sp) => (await sp.insert(s.appointments).values(values).returning({ id: s.appointments.id }))[0]!.id);
        } catch (e) {
          const err = e as { code?: string; cause?: { code?: string } };
          if (err.code !== "23P01" && err.cause?.code !== "23P01") throw e;
          overlaps++;
          apptId = (await tx.insert(s.appointments).values({ ...values, overbooked: true }).returning({ id: s.appointments.id }))[0]!.id;
        }
        count("appointments");

        const pay = bk.payment ?? {};
        if ((pay.method && pay.method !== "none") || (pay.status && pay.status !== "none")) {
          await tx.insert(s.appointmentPayments).values({
            appointmentId: apptId,
            method: ["online", "on_site", "bank_transfer", "paypal", "cash", "none"].includes(pay.method) ? pay.method : "none",
            status: ["none", "authorized", "paid", "refunded", "partial", "penalty", "failed"].includes(pay.status) ? pay.status : "none",
            amountCents: Math.round((Number(pay.amount) || 0) * 100),
            penaltyCents: Math.round((Number(pay.penaltyAmount) || 0) * 100),
            keptCents: Math.round((Number(pay.keptAmount) || 0) * 100),
            currency: text(pay.currency) ?? "eur",
            stripePaymentIntentId: text(pay.stripePaymentIntentId),
            stripeSetupIntentId: text(pay.stripeSetupIntentId),
            stripeCustomerId: text(pay.stripeCustomerId),
            stripePaymentMethodId: text(pay.stripePaymentMethodId),
            cardBrand: text(pay.cardBrand),
            cardLast4: text(pay.cardLast4),
            paidAt: date(pay.paidAt),
            cancellationDecision: pay.cancellationReviewDecision === "refunded" || pay.cancellationReviewDecision === "kept" ? pay.cancellationReviewDecision : null,
            cancellationReviewedAt: date(pay.cancellationReviewedAt),
          });
          count("appointment_payments");
        }
      }
      if (overlaps) warn(`${overlaps} RDV qui se chevauchaient dans l'ancienne base ont été marqués « surréservation ».`);

      // ── 7. Avis ─────────────────────────────────────────────────────────
      const reviewByLegacy = new Map<string, string>();
      const seenReview = new Set<string>();
      for (const r of src.reviews) {
        const cid = resolveCompany(r.company);
        if (!cid) continue;
        const biz = bizByLegacy.get(cid)!;
        const uid = r.client ? (userByLegacy.get(id(r.client)!) ?? null) : null;
        if (uid && seenReview.has(`${biz.id}:${uid}`)) continue;
        if (uid) seenReview.add(`${biz.id}:${uid}`);
        const rid = randomUUID();
        reviewByLegacy.set(id(r._id)!, rid);
        await tx.insert(s.reviews).values({ id: rid, businessId: biz.id, userId: uid, authorName: text(r.clientName) ?? "Client", authorAvatarUrl: image(r.clientPicture), rating: Math.min(5, Math.max(1, Number(r.rating) || 5)), comment: text(r.comment), legacyId: id(r._id), createdAt: date(r.createdAt) ?? new Date() });
        count("reviews");
      }
      for (const rr of src.reviewreports) {
        const cid = resolveCompany(rr.company);
        if (!cid) continue;
        await tx.insert(s.reviewReports).values({
          reviewId: reviewByLegacy.get(id(rr.review) ?? "") ?? null,
          businessId: bizByLegacy.get(cid)!.id,
          reporterKind: ["visitor", "user", "owner"].includes(rr.reporterKind) ? rr.reporterKind : "visitor",
          reporterUserId: rr.reporterId ? (userByLegacy.get(id(rr.reporterId)!) ?? null) : null,
          reporterFingerprint: text(rr.reporterFingerprint),
          reason: ["insulting", "false", "spam", "personal", "other"].includes(rr.reason) ? rr.reason : "other",
          message: text(rr.message),
          snapshot: { authorName: String(rr.snapshot?.clientName ?? ""), rating: Number(rr.snapshot?.rating ?? 0), comment: text(rr.snapshot?.comment), createdAt: (date(rr.snapshot?.createdAt) ?? new Date()).toISOString() },
          status: ["pending", "accepted", "rejected"].includes(rr.status) ? rr.status : "pending",
          decidedAt: date(rr.decidedAt),
          decisionNote: text(rr.decisionNote),
        });
        count("review_reports");
      }

      // ── 8. Sites, journal, contenus de la plateforme ───────────────────
      for (const site of src.sites) {
        const cid = resolveCompany(site.company);
        if (!cid) continue;
        await tx.insert(s.sites).values({
          businessId: bizByLegacy.get(cid)!.id,
          slug: text(site.slug),
          customDomain: lower(site.customDomain),
          publishedAt: site.isPublished ? (date(site.updatedAt) ?? new Date()) : null,
          template: text(site.theme?.siteTemplate) ?? "1",
          theme: { primaryColor: site.theme?.primaryColor ?? "#4f46e5", bgColor: site.theme?.bgColor ?? "#ffffff", textColor: site.theme?.textColor ?? "#0f0f1a", fontFamily: site.theme?.fontFamily ?? "Inter", headingFont: text(site.theme?.headingFont) ?? undefined, roundness: ["sharp", "soft", "round"].includes(site.theme?.roundness) ? site.theme.roundness : "soft" },
          seo: { title: text(site.seo?.title) ?? undefined, description: text(site.seo?.description) ?? undefined },
          sections: (site.sections ?? []).map((x: any) => ({ id: String(x.id ?? randomUUID()), type: x.type, enabled: x.enabled !== false, data: x.data ?? {} })),
          logoUrl: image(site.logoUrl),
          social: site.social ?? {},
          visitCount: Number(site.visitCount) || 0,
          legacyId: id(site._id),
        }).onConflictDoNothing();
        count("sites");
      }

      const logs = src.activitylogs.flatMap((l) => {
        const cid = resolveCompany(l.company);
        if (!cid) return [];
        return [{ businessId: bizByLegacy.get(cid)!.id, userId: l.user ? (userByLegacy.get(id(l.user)!) ?? null) : null, actorName: text(l.userName) ?? "—", action: text(l.action) ?? "legacy", description: text(l.description) ?? "", createdAt: date(l.createdAt) ?? new Date() }];
      });
      await insertMany(tx, s.activityLogs, logs, "activity_logs");

      const seenSlug = new Set<string>();
      for (const a of src.articles) {
        const slug = text(a.slug);
        if (!slug || seenSlug.has(slug)) continue;
        seenSlug.add(slug);
        await tx.insert(s.articles).values({ title: text(a.title) ?? slug, slug, excerpt: text(a.excerpt), coverImageUrl: image(a.coverImage), contentHtml: a.contentHtml ?? "", category: text(a.category), tags: a.tags ?? [], status: a.status === "published" ? "published" : a.scheduledFor ? "scheduled" : "draft", publishedAt: date(a.publishedAt), scheduledFor: date(a.scheduledFor), metaTitle: text(a.seo?.metaTitle), metaDescription: text(a.seo?.metaDescription), authorName: text(a.authorName) ?? "L’équipe Branshee", readingMinutes: Number(a.readingMinutes) || 1, views: Number(a.views) || 0, legacyId: id(a._id), createdAt: date(a.createdAt) ?? new Date() }).onConflictDoNothing();
        count("articles");
      }
      for (const p of src.promocodes) {
        if (!text(p.code)) continue;
        const [row] = await tx.insert(s.promoCodes).values({ code: text(p.code)!.toUpperCase(), discountType: ["percent", "fixed", "trial"].includes(p.discountType) ? p.discountType : "percent", discountValue: Number(p.discountValue) || 0, trialDays: Number(p.trialDays) || 30, maxUses: p.maxUses == null ? null : Number(p.maxUses), usedCount: Number(p.usedCount) || 0, expiresAt: date(p.expiresAt), isActive: p.active !== false, isDefaultOffer: !!p.isDefaultOffer, appliesTo: p.applicablePlan && p.applicablePlan !== "all" ? String(p.applicablePlan).replace("_monthly", ":month").replace("_yearly", ":year").replace("business", "pro_plus").replace("premium", "pro") : null, legacyId: id(p._id) }).onConflictDoNothing().returning({ id: s.promoCodes.id });
        if (!row) continue;
        count("promo_codes");
        const redemptions = [...new Set((p.usedByUsers ?? []).map((u: any) => userByLegacy.get(id(u)!)).filter(Boolean) as string[])].map((userId) => ({ promoCodeId: row.id, userId }));
        await insertMany(tx, s.promoRedemptions, redemptions, "promo_redemptions");
      }
      for (const l of src.accesslinks) {
        if (!text(l.code)) continue;
        const [row] = await tx.insert(s.accessLinks).values({ code: text(l.code)!.toUpperCase(), label: text(l.label), plan: l.plan === "business" ? "pro_plus" : "pro", durationDays: Number(l.durationDays) || 30, maxUses: Number(l.maxUses) || 1, usedCount: Number(l.usedCount) || 0, expiresAt: date(l.expiresAt), isActive: l.isActive !== false }).onConflictDoNothing().returning({ id: s.accessLinks.id });
        if (!row) continue;
        count("access_links");
        await insertMany(tx, s.accessLinkUses, (l.uses ?? []).map((u: any) => ({ accessLinkId: row.id, userId: u.userId ? (userByLegacy.get(id(u.userId)!) ?? null) : null, email: text(u.email), ip: text(u.ip), usedAt: date(u.usedAt) ?? new Date() })), "access_link_uses");
      }
      for (const f of src.featureflags) {
        if (!text(f.key)) continue;
        await tx.insert(s.featureFlags).values({ key: text(f.key)!, label: text(f.label) ?? text(f.key)!, status: ["active", "maintenance", "error", "disabled"].includes(f.status) ? f.status : "active", message: text(f.message) }).onConflictDoNothing();
        count("feature_flags");
      }
      for (const j of src.jobtitles) {
        if (!text(j.key)) continue;
        await tx.insert(s.jobTitles).values({ name: text(j.name) ?? text(j.key)!, key: text(j.key)!, status: ["pending", "approved", "blocked"].includes(j.status) ? j.status : "pending", source: j.source === "usage" ? "usage" : "request", requestedById: j.requestedBy ? (userByLegacy.get(id(j.requestedBy)!) ?? null) : null, decidedAt: date(j.decidedAt) }).onConflictDoNothing();
        count("job_titles");
      }
      for (const chat of src.supportchats) {
        const uid = userByLegacy.get(id(chat.user) ?? "");
        if (!uid) continue;
        await tx.insert(s.supportThreads).values({ userId: uid, unreadByAdmin: Number(chat.unreadByAdmin) || 0, unreadByUser: Number(chat.unreadByUser) || 0, lastMessageAt: date(chat.lastMessageAt) ?? new Date() }).onConflictDoNothing();
        count("support_threads");
        await insertMany(tx, s.supportMessages, (chat.messages ?? []).filter((m: any) => text(m?.text)).map((m: any) => ({ threadUserId: uid, sender: m.sender === "admin" ? "admin" : "user", body: text(m.text)!, createdAt: date(m.createdAt) ?? new Date() })), "support_messages");
      }
      for (const r of src.supportratings) {
        const uid = userByLegacy.get(id(r.user) ?? "");
        const rating = Math.round(Number(r.rating));
        if (!uid || !(rating >= 1 && rating <= 5)) continue;
        await tx.insert(s.supportRatings).values({ userId: uid, rating, createdAt: date(r.createdAt) ?? new Date() });
        count("support_ratings");
      }
      // Centre d'aide : un seul document « sections » dans l'ancien modèle.
      const helpDoc = src.supportcontents[0];
      for (const [i, sec] of ((helpDoc?.sections ?? []) as Doc[]).sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)).entries()) {
        if (!text(sec.title)) continue;
        await tx.insert(s.helpSections).values({
          title: text(sec.title)!,
          position: i,
          videos: (sec.videos ?? []).map((v: Doc) => ({ id: id(v._id) ?? crypto.randomUUID(), title: text(v.title) ?? "Vidéo", url: text(v.url) ?? "", duration: text(v.duration) ?? undefined })),
          faqs: (sec.faqs ?? []).filter((f: Doc) => text(f.question) && text(f.answer)).map((f: Doc) => ({ id: id(f._id) ?? crypto.randomUUID(), question: text(f.question)!, answer: String(f.answer) })),
        });
        count("help_sections");
      }
      for (const m of src.adminmessages) {
        if (!text(m.title) || !text(m.body)) continue;
        const recipientId = m.recipient ? (userByLegacy.get(id(m.recipient)!) ?? null) : null;
        if (m.recipient && !recipientId) continue;
        const [row] = await tx.insert(s.adminMessages).values({ recipientId, title: text(m.title)!, body: text(m.body)!, type: ["info", "warning", "security", "success", "tip"].includes(m.type) ? m.type : "info", ctaLabel: text(m.ctaLabel), ctaUrl: text(m.ctaUrl), createdAt: date(m.createdAt) ?? new Date() }).returning({ id: s.adminMessages.id });
        count("admin_messages");
        const dismissals = [...new Set((m.dismissedBy ?? []).map((u: any) => userByLegacy.get(id(u)!)).filter(Boolean) as string[])].map((userId) => ({ messageId: row!.id, userId }));
        await insertMany(tx, s.adminMessageDismissals, dismissals, "admin_message_dismissals");
      }

      if (DRY_RUN) throw new DryRunRollback();
    });
    console.log("\n✅ Migration terminée et enregistrée.");
  } catch (e) {
    if (e instanceof DryRunRollback) console.log("\n🧪 Essai à blanc : tout a été annulé, rien n'est écrit dans PostgreSQL.");
    else throw e;
  } finally {
    report.written = Object.fromEntries(Object.entries(report.written).sort());
    writeFileSync(REPORT_FILE, JSON.stringify({ ...report, finishedAt: new Date().toISOString() }, null, 2));
    console.log("Écrit :", report.written);
    console.log(`${report.warnings.length} avertissement(s) — détail dans ${REPORT_FILE}`);
    await client.end();
  }
}

main().catch((e) => {
  console.error("\n❌ Migration interrompue, aucune donnée écrite :", e instanceof Error ? e.message : e);
  process.exit(1);
});
