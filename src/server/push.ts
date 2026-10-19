import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { pushTokens } from "@/db/schema";
import { isStaging } from "@/lib/staging";

/**
 * Notifications push de l'application (service Expo : il relaie vers APNs et FCM, aucun certificat côté serveur).
 * Un envoi raté ne fait jamais échouer l'action qui l'a déclenché. Les jetons d'appareils désinstallés sont purgés.
 */
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export async function sendPush(userIds: string | string[], msg: { title: string; body: string; data?: Record<string, unknown> }): Promise<{ sent: number }> {
  if (isStaging()) return { sent: 0 };
  try {
    const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])].filter(Boolean);
    if (!ids.length) return { sent: 0 };
    const devices = await db.select({ token: pushTokens.token }).from(pushTokens).where(inArray(pushTokens.userId, ids));
    const messages = devices
      .map((d) => d.token)
      .filter((t) => EXPO_TOKEN.test(t))
      .map((to) => ({ to, title: msg.title, body: msg.body, data: msg.data ?? {}, sound: "default", priority: "high", channelId: "default" }));
    let sent = 0;
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      const res = await fetch(EXPO_PUSH_URL, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(batch), signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const tickets = ((await res.json()) as { data?: { status: string; details?: { error?: string } }[] }).data ?? [];
      sent += tickets.filter((t) => t.status === "ok").length;
      const dead = tickets.flatMap((t, j) => (t.status === "error" && t.details?.error === "DeviceNotRegistered" ? [batch[j]!.to] : []));
      for (const token of dead) await db.delete(pushTokens).where(eq(pushTokens.token, token));
    }
    return { sent };
  } catch (e) {
    console.error("[push]", e instanceof Error ? e.message : e);
    return { sent: 0 };
  }
}
