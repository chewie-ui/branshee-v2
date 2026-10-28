import type { Metadata } from "next";
import { ChatApp } from "@/components/chat/chat-app";
import { requireContext } from "@/server/context";
import { chatOverview, chatRights } from "@/server/chat";

export const metadata: Metadata = { title: "Messagerie" };

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const ctx = await requireContext();
  const { channels, team } = await chatOverview(ctx);
  const c = (await searchParams).c;
  const initial = channels.find((x) => x.id === c)?.id ?? channels.find((x) => x.kind === "channel")?.id ?? null;
  return (
    <>
      <h1 className="sr-only">Messagerie</h1>
      <ChatApp initialChannels={channels} team={team} me={ctx.member.id} initial={initial} canManage={chatRights(ctx).manage} />
    </>
  );
}
