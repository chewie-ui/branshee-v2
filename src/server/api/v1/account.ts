import "server-only";
import { randomBytes } from "node:crypto";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, businesses, customers, googleCalendarConnections, members, notificationSettings, pushTokens, users } from "@/db/schema";
import { changePassword, setLocale } from "@/server/actions/account";
import { issueCode, consumeCode } from "@/server/codes";
import { deleteUserAccount } from "@/server/account-deletion";
import { deletePublicImage, savePublicImage } from "@/server/storage";
import { disconnectCalendar, googleConfigured } from "@/server/google";
import { currentContext } from "@/server/context";
import { rateLimit } from "@/server/auth/rate-limit";
import { PROFESSIONS, professionKey } from "@/lib/professions";
import { readChallenge, signChallenge } from "@/server/api/tokens";
import { bool, ensureOk, fail, has, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { PLACEHOLDER_AVATAR, siteUrl } from "@/server/api/v1/shared";
import { sendPush } from "@/server/push";

const LANGS = ["fr", "en", "nl", "de", "es", "it"] as const;

async function me(r: ApiRequest) {
  const [u] = await db.select().from(users).where(eq(users.id, r.auth!.userId));
  return u ?? fail(401, "unauthorized", "Compte introuvable.");
}

/** Image envoyée en multipart (champ « photo »), 5 Mo maximum, format vérifié. */
export async function readPhoto(r: ApiRequest) {
  let form: FormData;
  // Refus avant lecture du corps : un envoi énorme ne doit pas remplir la mémoire.
  if (Number(r.raw.headers.get("content-length") ?? 0) > 6 * 1024 * 1024) return invalid("Photo trop lourde (5 Mo maximum).");
  try {
    form = await r.raw.formData();
  } catch {
    return invalid("Aucune photo reçue.");
  }
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return invalid("Aucune photo reçue.");
  if (file.size > 5 * 1024 * 1024) return invalid("Photo trop lourde (5 Mo maximum).");
  try {
    return await savePublicImage(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return invalid(e instanceof Error ? e.message : "Photo invalide.");
  }
}

/** Notifications « nouvelle réservation » et « annulation » : réglées sur l'établissement actif (comme sur le site). */
async function notifications(userId: string) {
  const ctx = await currentContext();
  if (ctx) {
    const [n] = await db.select().from(notificationSettings).where(eq(notificationSettings.businessId, ctx.business.id));
    return { newBooking: n?.emailOwnerOnNewBooking ?? true, cancellation: n?.emailOwnerOnCancellation ?? true };
  }
  const [u] = await db.select({ on: users.emailNotifications }).from(users).where(eq(users.id, userId));
  return { newBooking: u?.on ?? true, cancellation: u?.on ?? true };
}

async function settings(r: ApiRequest) {
  const u = await me(r);
  return {
    profile: { fullName: u.fullName, phone: u.phone ?? "", email: u.email, hasPassword: !!u.passwordHash, profilePicture: u.avatarUrl ?? PLACEHOLDER_AVATAR, hasPhoto: !!u.avatarUrl },
    lang: u.locale,
    notifications: await notifications(u.id),
    twoFactor: { enabled: !!u.twoFactorSecret, manageUrl: siteUrl("/app/compte") },
  };
}

async function updateProfile(r: ApiRequest) {
  const u = await me(r);
  const fullName = has(r.body, "fullName") ? str(r.body.fullName, 120) : u.fullName;
  const phone = has(r.body, "phone") ? str(r.body.phone, 40) : (u.phone ?? "");
  if (fullName.length < 2) return invalid("Indiquez votre nom.", { field: "fullName" });
  if (phone && !/^[+\d][\d\s().-]{5,}$/.test(phone)) return invalid("Numéro de téléphone invalide.", { field: "phone" });
  await db.update(users).set({ fullName, phone: phone || null }).where(eq(users.id, u.id));
  return { ok: true, profile: { fullName, phone } };
}

async function updateNotifications(r: ApiRequest) {
  const ctx = await currentContext();
  const cur = await notifications(r.auth!.userId);
  const next = { newBooking: has(r.body, "newBooking") ? bool(r.body.newBooking) : cur.newBooking, cancellation: has(r.body, "cancellation") ? bool(r.body.cancellation) : cur.cancellation };
  if (ctx) {
    if (!ctx.can("settings.manage")) return fail(403, "forbidden", "Votre grade ne permet pas de modifier les notifications de l'établissement.");
    await db.insert(notificationSettings).values({ businessId: ctx.business.id, emailOwnerOnNewBooking: next.newBooking, emailOwnerOnCancellation: next.cancellation }).onConflictDoUpdate({ target: notificationSettings.businessId, set: { emailOwnerOnNewBooking: next.newBooking, emailOwnerOnCancellation: next.cancellation } });
  } else {
    await db.update(users).set({ emailNotifications: next.newBooking || next.cancellation }).where(eq(users.id, r.auth!.userId));
  }
  return { ok: true, notifications: next };
}

async function deletionRequest(r: ApiRequest) {
  const u = await me(r);
  if (!rateLimit(`del:${u.id}`, 4, 60 * 60 * 1000).ok) return fail(429, "rate_limited", "Trop de demandes. Réessayez plus tard.");
  const owned = await db.select({ id: businesses.id, name: businesses.name }).from(businesses).where(and(eq(businesses.ownerId, u.id), isNull(businesses.deletedAt)));
  const ids = owned.map((b) => b.id);
  const [b] = ids.length ? await db.select({ n: count() }).from(appointments).where(sql`${appointments.businessId} in ${ids}`) : [{ n: 0 }];
  const [c] = ids.length ? await db.select({ n: count() }).from(customers).where(sql`${customers.businessId} in ${ids}`) : [{ n: 0 }];
  await issueCode({ id: u.id, name: u.fullName }, u.email, "account_deletion");
  return { ok: true, challengeToken: signChallenge({ k: "delete", u: u.id }, 15), expiresIn: 900, email: u.email, summary: { establishments: owned.length, establishmentNames: owned.map((o) => o.name), bookings: b?.n ?? 0, clients: c?.n ?? 0 } };
}

async function deletionConfirm(r: ApiRequest) {
  const c = readChallenge<{ k: string; u: string }>(r.body.challengeToken);
  if (!c || c.k !== "delete" || c.u !== r.auth!.userId) return fail(401, "challenge_expired", "Délai dépassé. Recommencez.");
  const res = await consumeCode(c.u, "account_deletion", str(r.body.code, 12));
  if (!res.ok) return fail(400, "invalid_code", res.error);
  const u = await me(r);
  await deleteUserAccount(u.id, { id: u.id, name: u.fullName });
  return { ok: true };
}

/* ── Intégrations : la connexion Google se fait sur le site (OAuth navigateur) ── */

async function integrations(r: ApiRequest) {
  const userId = r.auth!.userId;
  const [g] = await db.select({ email: googleCalendarConnections.googleEmail }).from(googleCalendarConnections).where(eq(googleCalendarConnections.userId, userId));
  const ctx = await currentContext();
  let token = "";
  if (ctx) {
    const [m] = await db.select({ t: members.calendarFeedToken }).from(members).where(eq(members.id, ctx.member.id));
    token = m?.t ?? "";
    if (!token) {
      token = randomBytes(24).toString("hex");
      await db.update(members).set({ calendarFeedToken: token }).where(eq(members.id, ctx.member.id));
    }
  }
  const feedUrl = token ? siteUrl(`/ical/${token}`) : "";
  return {
    googleCalendar: { connected: !!g, email: g?.email ?? "", connectUrl: googleConfigured() ? siteUrl("/app/reglages/integrations") : "" },
    ical: { token, feedUrl, webcalUrl: feedUrl.replace(/^https?:/, "webcal:") },
  };
}

/* ── Notifications push (jetons Expo) ── */

async function registerPush(r: ApiRequest) {
  const token = str(r.body.token, 300);
  if (!/^Expo(nent)?PushToken\[[^\]]+\]$/.test(token)) return invalid("Jeton de notification invalide.");
  const platform = ["ios", "android", "web"].includes(String(r.body.platform)) ? (r.body.platform as "ios" | "android" | "web") : "unknown";
  await db.insert(pushTokens).values({ userId: r.auth!.userId, token, platform }).onConflictDoUpdate({ target: pushTokens.token, set: { userId: r.auth!.userId, platform, lastSeenAt: new Date() } });
  return { ok: true };
}

export const accountRoutes: Route[] = [
  { method: "GET", path: "/account/settings", handler: settings },
  { method: "PATCH", path: "/account/profile", handler: updateProfile },
  {
    method: "POST",
    path: "/account/password",
    handler: async (r) => {
      const u = await me(r);
      if (!u.passwordHash) return fail(400, "no_password", "Ce compte se connecte avec Google ou Apple : définissez d'abord un mot de passe sur le site.");
      ensureOk(await changePassword({ current: str(r.body.oldPassword, 200), next: typeof r.body.newPassword === "string" ? r.body.newPassword : "" }));
      return { ok: true };
    },
  },
  {
    method: "PATCH",
    path: "/account/language",
    handler: async (r) => {
      const lang = str(r.body.lang, 5);
      if (!(LANGS as readonly string[]).includes(lang)) return invalid("Langue inconnue.");
      ensureOk(await setLocale(lang));
      return { ok: true, lang };
    },
  },
  { method: "PATCH", path: "/account/notifications", handler: updateNotifications },
  { method: "GET", path: "/account/2fa/status", handler: async (r) => ({ enabled: !!(await me(r)).twoFactorSecret, manageUrl: siteUrl("/app/compte") }) },
  {
    method: "POST",
    path: "/account/photo",
    handler: async (r) => {
      const u = await me(r);
      const url = await readPhoto(r);
      await db.update(users).set({ avatarUrl: url }).where(eq(users.id, u.id));
      await deletePublicImage(u.avatarUrl);
      return { ok: true, profilePicture: url, hasPhoto: true };
    },
  },
  {
    method: "DELETE",
    path: "/account/photo",
    handler: async (r) => {
      const u = await me(r);
      await db.update(users).set({ avatarUrl: null }).where(eq(users.id, u.id));
      await deletePublicImage(u.avatarUrl);
      return { ok: true, profilePicture: PLACEHOLDER_AVATAR, hasPhoto: false };
    },
  },
  { method: "POST", path: "/account/delete/request", handler: deletionRequest },
  { method: "POST", path: "/account/delete/confirm", handler: deletionConfirm },

  { method: "GET", path: "/integrations", handler: integrations },
  {
    method: "POST",
    path: "/integrations/google-calendar/disconnect",
    handler: async (r) => {
      await disconnectCalendar(r.auth!.userId);
      return { ok: true, googleCalendar: { connected: false, email: "", connectUrl: googleConfigured() ? siteUrl("/app/reglages/integrations") : "" } };
    },
  },

  { method: "POST", path: "/push/register", handler: registerPush },
  {
    method: "DELETE",
    path: "/push/register",
    handler: async (r) => {
      await db.delete(pushTokens).where(and(eq(pushTokens.token, str(r.body.token, 300)), eq(pushTokens.userId, r.auth!.userId)));
      return { ok: true };
    },
  },
  { method: "POST", path: "/push/test", handler: async (r) => sendPush(r.auth!.userId, { title: "Branshee", body: "Les notifications fonctionnent sur cet appareil.", data: { type: "test" } }) },

  {
    method: "GET",
    path: "/business-types",
    handler: async (r) => {
      const q = professionKey(str(r.query.get("q"), 80));
      const list = q ? PROFESSIONS.filter((p) => professionKey(p).includes(q)) : [...PROFESSIONS];
      return { lang: "fr", count: list.length, businessTypes: list };
    },
  },
];
