import "server-only";
import { headers } from "next/headers";
import { createChannel, deleteChannel, deleteMessage, fetchMessages, openDirect, sendMessage } from "@/server/actions/chat";
import { fail, forbidden, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { chatOverview, chatRights } from "@/server/chat";
import { currentContext, type AppContext } from "@/server/context";
import { isLocked } from "@/server/plan";

/** API mobile de l'app Messagerie (Skydev) : salons, messages privés, non lus, envoi et suppression. */

async function needChat(): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("messagerie")) return forbidden();
  const method = (await headers()).get("x-method") ?? "POST";
  if (method !== "GET" && (await isLocked(ctx.business.id, ctx.business.brand))) return fail(402, "read_only", "Votre essai est terminé : abonnez-vous pour continuer à modifier.");
  return ctx;
}

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const ok = <T extends { ok: boolean }>(r: T) => {
  const e = r as { ok: boolean; error?: string };
  if (!e.ok) return invalid(e.error ?? "Action impossible.");
  return r as T & { id?: string };
};

async function overview() {
  const ctx = await needChat();
  const { channels, team } = await chatOverview(ctx);
  return { me: ctx.member.id, canManage: chatRights(ctx).manage, channels, team };
}

async function messages(r: ApiRequest) {
  await needChat();
  if (!uuid(r.params.id)) return fail(404, "not_found", "Discussion introuvable.");
  const res = await fetchMessages(r.params.id!, r.query.get("after"));
  if (!res.ok) return fail(404, "not_found", res.error);
  return { messages: res.messages };
}

export const messagerieRoutes: Route[] = [
  { method: "GET", path: "/chat", handler: overview },
  { method: "GET", path: "/chat/:id/messages", handler: messages },
  {
    method: "POST",
    path: "/chat/:id/messages",
    handler: async (r) => {
      await needChat();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Discussion introuvable.");
      return { ok: true, id: ok(await sendMessage(r.params.id!, str(r.body.body, 4000))).id ?? null };
    },
  },
  {
    method: "DELETE",
    path: "/chat/messages/:id",
    handler: async (r) => {
      await needChat();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Message introuvable.");
      ok(await deleteMessage(r.params.id!));
      return { ok: true };
    },
  },
  {
    method: "POST",
    path: "/chat/channels",
    handler: async (r) => {
      await needChat();
      return { ok: true, id: ok(await createChannel(str(r.body.name, 60))).id ?? null };
    },
  },
  {
    method: "DELETE",
    path: "/chat/channels/:id",
    handler: async (r) => {
      await needChat();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Salon introuvable.");
      ok(await deleteChannel(r.params.id!));
      return { ok: true };
    },
  },
  {
    method: "POST",
    path: "/chat/direct",
    handler: async (r) => {
      await needChat();
      return { ok: true, id: ok(await openDirect(str(r.body.memberId, 40))).id ?? null };
    },
  },
];
