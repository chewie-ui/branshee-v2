"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";
import { cleanPrefs, type UiPrefs } from "@/lib/ui-prefs";
import { appNotificationsOf, markAllAppNotificationsRead, type AppNotification } from "@/server/app-notifications";

/** Enregistre la personnalisation de l'utilisateur connecté (fusion avec l'existant, valeurs vérifiées). */
export async function saveUiPrefs(patch: Partial<UiPrefs>): Promise<{ ok: true; prefs: UiPrefs } | { ok: false; error: string }> {
  const s = await getSessionUser();
  if (!s) return { ok: false, error: "Session expirée : reconnectez-vous." };
  const prefs = cleanPrefs({ ...cleanPrefs(s.user.uiPrefs), ...patch });
  await db.update(users).set({ uiPrefs: prefs }).where(eq(users.id, s.user.id));
  return { ok: true, prefs };
}

/** Notifications de l'espace pro (interrogées régulièrement par la cloche). */
export async function fetchAppNotifications(after?: string | null): Promise<{ items: AppNotification[]; unread: number } | null> {
  const s = await getSessionUser();
  if (!s) return null;
  const d = after ? new Date(after) : null;
  return appNotificationsOf(s.user.id, d && !Number.isNaN(d.getTime()) ? d : null);
}

export async function markAppNotificationsRead(): Promise<void> {
  const s = await getSessionUser();
  if (s) await markAllAppNotificationsRead(s.user.id);
}
