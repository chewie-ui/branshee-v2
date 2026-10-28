"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setAssistantEnabled } from "@/server/actions/assistant";

export function AssistantToggle({ on }: { on: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [notHealth, setNotHealth] = useState(false);
  const toggle = () =>
    start(async () => {
      const r: { ok: boolean; error?: string; message?: string } = await setAssistantEnabled(!on, notHealth).catch(() => ({ ok: false, error: "Action impossible. Vérifiez votre connexion." }));
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Fait.") : (r.error ?? "Action impossible.") });
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
      {!on ? <label className="flex w-full items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 size-4" checked={notHealth} onChange={(e) => setNotHealth(e.target.checked)} />Je confirme que mon entreprise n&apos;est pas une profession de santé (aucune donnée de patient).</label> : null}
      <p className="flex-1 text-sm font-medium">{on ? "L'assistant est activé pour toute l'équipe." : "L'assistant est désactivé."}</p>
      <Button variant={on ? "secondary" : "primary"} loading={pending} disabled={!on && !notHealth} onClick={toggle}>{on ? "Désactiver" : "Activer l'assistant"}</Button>
      {msg ? <p className={msg.ok ? "w-full text-sm text-success" : "w-full text-sm text-danger"} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
    </div>
  );
}
