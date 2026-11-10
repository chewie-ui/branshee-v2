import type { Metadata } from "next";
import { ChatApp } from "@/components/chat/chat-app";
import { requireContext } from "@/server/context";
import { chatOverview, chatRights } from "@/server/chat";
import { appMetadata } from "@/server/app-locale";
import { appT } from "@/server/app-locale";

export const generateMetadata = appMetadata("Messagerie");

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const t = await appT();
  const ctx = await requireContext();
  const { channels, team } = await chatOverview(ctx);
  const c = (await searchParams).c;
  const initial = channels.find((x) => x.id === c)?.id ?? channels.find((x) => x.kind === "channel")?.id ?? null;
  return (
    <>
      <h1 className="sr-only">{t("Messagerie")}</h1>
      <ChatApp initialChannels={channels} team={team} me={ctx.member.id} initial={initial} canManage={chatRights(ctx).manage} />
    </>
  );
}
