"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveChat, useLiveChat } from "@/components/support/live-chat";
import { adminSupportTyping, closeSupport, deleteSupportThread, replySupport } from "@/server/actions/admin-relations";
import type { SupportLive } from "@/server/support";

/** Chat de support côté équipe : en direct, images, « le pro écrit… », « Vu », clôture et suppression. */
export function AdminSupportChat({ userId, name, initial }: { userId: string; name: string; initial: SupportLive }) {
  const router = useRouter();
  const { messages, thread, poll } = useLiveChat(`/api/admin/support/${userId}`, initial);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <LiveChat
        side="admin"
        className="flex-1"
        messages={messages}
        thread={thread}
        poll={poll}
        send={(fd) => replySupport(userId, fd)}
        typing={() => adminSupportTyping(userId)}
        otherName={name}
        placeholder="Votre réponse…"
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
        {!thread?.closedAt ? (
          <Button type="button" size="sm" variant="secondary" loading={pending} onClick={() => start(async () => { await closeSupport(userId); await poll(); router.refresh(); })}>Clôturer (demander une note)</Button>
        ) : null}
        {confirm ? (
          <span className="ml-auto flex items-center gap-2 text-sm">
            Supprimer la conversation ?
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm(false)}>Non</Button>
            <Button type="button" size="sm" variant="danger" loading={pending} onClick={() => start(async () => { await deleteSupportThread(userId); router.push("/admin/support"); })}>Oui</Button>
          </span>
        ) : (
          <Button type="button" size="sm" variant="ghost" className="ml-auto text-danger hover:text-danger" onClick={() => setConfirm(true)} icon={<Trash2 className="size-4" aria-hidden="true" />}>Supprimer</Button>
        )}
      </div>
    </>
  );
}
