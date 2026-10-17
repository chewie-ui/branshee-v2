import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointments, businesses, googleCalendarConnections, members } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/field-crypto";
import { businessHas } from "@/server/plan";

/**
 * Google : connexion (« Continuer avec Google ») et synchronisation Google Agenda.
 * Appels REST directs (pas de SDK) ; jetons de rafraîchissement chiffrés en base.
 */
export const googleConfigured = () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
const appUrl = () => (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");
const stateKey = () => createHmac("sha256", "google-state").update(process.env.DATA_ENCRYPTION_KEY ?? "dev").digest();

/** `state` signé (anti-CSRF) : porte l'intention, le compte et la page de retour. */
export function signState(data: Record<string, string>) {
  const payload = Buffer.from(JSON.stringify({ ...data, n: randomBytes(8).toString("hex"), e: Date.now() + 10 * 60000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", stateKey()).update(payload).digest("base64url")}`;
}
export function readState(state: string): Record<string, string> | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const a = Buffer.from(sig, "base64url");
  const b = createHmac("sha256", stateKey()).update(payload).digest();
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const v = JSON.parse(Buffer.from(payload, "base64url").toString()) as Record<string, string> & { e: number };
    return v.e > Date.now() ? v : null;
  } catch {
    return null;
  }
}

export function authUrl(kind: "login" | "calendar", state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${appUrl()}/auth/google/retour`,
    response_type: "code",
    state,
    scope: kind === "calendar" ? "openid email https://www.googleapis.com/auth/calendar.events" : "openid email profile",
    ...(kind === "calendar" ? { access_type: "offline", prompt: "consent", include_granted_scopes: "true" } : { prompt: "select_account" }),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeCode(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: `${appUrl()}/auth/google/retour`, grant_type: "authorization_code" }),
  });
  if (!res.ok) throw new Error(`Google token ${res.status}`);
  const t = (await res.json()) as { access_token: string; refresh_token?: string; id_token?: string; scope?: string };
  // Identité lue via l'API userinfo (plutôt que de décoder le jeton d'identité soi-même).
  const info = (await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${t.access_token}` } })).json()) as { sub: string; email: string; email_verified: boolean; name?: string; picture?: string };
  return { ...t, info };
}

async function accessToken(refreshEnc: string) {
  const refresh = decrypt(refreshEnc);
  if (!refresh) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: refresh, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  if (!res?.ok) return null;
  return ((await res.json()) as { access_token: string }).access_token;
}

export async function saveCalendarConnection(userId: string, email: string, refreshToken: string, scope: string | undefined) {
  const values = { googleEmail: email, refreshTokenEnc: encrypt(refreshToken)!, scope: scope ?? null };
  await db.insert(googleCalendarConnections).values({ userId, ...values }).onConflictDoUpdate({ target: googleCalendarConnections.userId, set: values });
}

export async function disconnectCalendar(userId: string) {
  const [c] = await db.select().from(googleCalendarConnections).where(eq(googleCalendarConnections.userId, userId));
  if (!c) return;
  const refresh = decrypt(c.refreshTokenEnc);
  if (refresh) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, { method: "POST" }).catch(() => {});
  await db.delete(googleCalendarConnections).where(eq(googleCalendarConnections.userId, userId));
}

/** Connexion Google Agenda du praticien d'un RDV (s'il en a une et que le forfait le permet). */
async function connectionForMember(memberId: string | null) {
  if (!memberId || !googleConfigured()) return null;
  const [row] = await db
    .select({ c: googleCalendarConnections, businessId: members.businessId })
    .from(members)
    .innerJoin(googleCalendarConnections, eq(googleCalendarConnections.userId, members.userId))
    .where(eq(members.id, memberId));
  if (!row || !(await businessHas(row.businessId, "googleCalendar"))) return null;
  return row.c;
}

const api = (token: string, path: string, init: RequestInit = {}) =>
  fetch(`https://www.googleapis.com/calendar/v3${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(6000) });

/**
 * Crée, met à jour ou supprime l'événement Google d'un RDV selon son état. Jamais bloquant.
 * L'événement ne contient que le nom du client et la prestation (pas de notes ni de dossier).
 */
export async function syncAppointmentToGoogle(appointmentId: string) {
  try {
    const [row] = await db
      .select({ a: appointments, bizName: businesses.name, tz: businesses.timezone })
      .from(appointments)
      .innerJoin(businesses, eq(businesses.id, appointments.businessId))
      .where(eq(appointments.id, appointmentId));
    if (!row || row.a.kind !== "appointment") return;
    const conn = await connectionForMember(row.a.memberId);
    if (!conn) return;
    const token = await accessToken(conn.refreshTokenEnc);
    if (!token) return;
    const a = row.a;
    if (a.status === "cancelled") {
      if (a.googleEventId) await api(token, `/calendars/primary/events/${encodeURIComponent(a.googleEventId)}`, { method: "DELETE" }).catch(() => {});
      if (a.googleEventId) await db.update(appointments).set({ googleEventId: null }).where(eq(appointments.id, a.id));
      return;
    }
    const event = {
      summary: `RDV – ${a.contactName ?? "Client"}${a.serviceName ? ` · ${a.serviceName}` : ""}`,
      description: [a.contactPhone ? `Téléphone : ${a.contactPhone}` : null, a.status === "pending" ? "En attente de confirmation" : null, `${appUrl()}/app/agenda/rdv/${a.id}`].filter(Boolean).join("\n"),
      start: { dateTime: a.startsAt.toISOString(), timeZone: row.tz },
      end: { dateTime: a.endsAt.toISOString(), timeZone: row.tz },
      source: { title: `Branshee — ${row.bizName}`, url: `${appUrl()}/app/agenda/rdv/${a.id}` },
      extendedProperties: { private: { branshee: a.id } },
    };
    let res = a.googleEventId ? await api(token, `/calendars/primary/events/${encodeURIComponent(a.googleEventId)}`, { method: "PUT", body: JSON.stringify(event) }) : null;
    if (!res || res.status === 404 || res.status === 410) res = await api(token, "/calendars/primary/events", { method: "POST", body: JSON.stringify(event) });
    if (res.ok) {
      const id = ((await res.json()) as { id?: string }).id;
      if (id && id !== a.googleEventId) await db.update(appointments).set({ googleEventId: id }).where(eq(appointments.id, a.id));
    }
  } catch (e) {
    console.error("[google] synchronisation :", e instanceof Error ? e.message : e);
  }
}

/** À la connexion : envoie les RDV à venir du praticien dans son Google Agenda. */
export async function pushUpcomingToGoogle(userId: string) {
  const mine = await db.select({ id: members.id }).from(members).where(eq(members.userId, userId));
  if (!mine.length) return;
  const upcoming = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(inArray(appointments.memberId, mine.map((m) => m.id)), eq(appointments.kind, "appointment"), ne(appointments.status, "cancelled"), gt(appointments.startsAt, new Date())))
    .limit(300);
  for (const u of upcoming) await syncAppointmentToGoogle(u.id);
}

/**
 * Plages occupées dans les agendas Google des praticiens (événements personnels) : elles bloquent
 * la réservation en ligne. Les événements créés par Branshee sont ignorés (déjà comptés).
 */
export async function googleBusy(memberIds: string[], from: Date, to: Date): Promise<{ memberId: string; start: Date; end: Date }[]> {
  if (!googleConfigured() || !memberIds.length) return [];
  const rows = await db
    .select({ memberId: members.id, businessId: members.businessId, c: googleCalendarConnections })
    .from(members)
    .innerJoin(googleCalendarConnections, eq(googleCalendarConnections.userId, members.userId))
    .where(and(inArray(members.id, memberIds), isNotNull(members.userId)));
  const out: { memberId: string; start: Date; end: Date }[] = [];
  await Promise.all(
    rows.map(async (r) => {
      if (!(await businessHas(r.businessId, "googleCalendar"))) return;
      const token = await accessToken(r.c.refreshTokenEnc);
      if (!token) return;
      const res = await api(token, `/calendars/primary/events?${new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: "true", maxResults: "250" })}`).catch(() => null);
      if (!res?.ok) return;
      const data = (await res.json()) as { items?: { start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; transparency?: string; status?: string; extendedProperties?: { private?: Record<string, string> } }[] };
      for (const ev of data.items ?? []) {
        if (ev.status === "cancelled" || ev.transparency === "transparent" || ev.extendedProperties?.private?.branshee) continue;
        const start = ev.start?.dateTime ?? (ev.start?.date ? `${ev.start.date}T00:00:00` : null);
        const end = ev.end?.dateTime ?? (ev.end?.date ? `${ev.end.date}T00:00:00` : null);
        if (start && end) out.push({ memberId: r.memberId, start: new Date(start), end: new Date(end) });
      }
    }),
  );
  return out;
}
