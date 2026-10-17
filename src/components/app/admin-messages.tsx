"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { CheckCircle2, Info, Lightbulb, ShieldAlert, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { dismissAdminMessage } from "@/server/actions/support";

type Message = { id: string; title: string; body: string; type: "info" | "warning" | "security" | "success" | "tip"; ctaLabel: string | null; ctaUrl: string | null };

const STYLE: Record<Message["type"], { icon: typeof Info; cls: string }> = {
  info: { icon: Info, cls: "border-accent/30 bg-accent-soft" },
  tip: { icon: Lightbulb, cls: "border-accent/30 bg-accent-soft" },
  success: { icon: CheckCircle2, cls: "border-success/30 bg-success-soft" },
  warning: { icon: TriangleAlert, cls: "border-warning/40 bg-warning-soft" },
  security: { icon: ShieldAlert, cls: "border-danger/30 bg-danger-soft" },
};

/** Messages de l'équipe Branshee (annonces, alertes de solde, sécurité…), en haut de l'espace pro. */
export function AdminMessages({ messages }: { messages: Message[] }) {
  const [list, hide] = useOptimistic(messages, (cur, id: string) => cur.filter((m) => m.id !== id));
  const [, start] = useTransition();
  if (!list.length) return null;
  return (
    <div className="mb-6 space-y-2">
      {list.map((m) => {
        const s = STYLE[m.type] ?? STYLE.info;
        const external = m.ctaUrl && !m.ctaUrl.startsWith("/");
        return (
          <div key={m.id} className={cn("flex gap-3 rounded-xl border px-4 py-3", s.cls)} role={m.type === "warning" || m.type === "security" ? "alert" : "status"}>
            <s.icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{m.title}</p>
              <p className="mt-0.5 text-sm whitespace-pre-line text-text/80">{m.body}</p>
              {m.ctaLabel && m.ctaUrl ? (
                <Link href={m.ctaUrl} className="mt-1.5 inline-flex text-sm font-medium text-accent hover:text-accent-hover" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                  {m.ctaLabel}
                </Link>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => start(async () => { hide(m.id); await dismissAdminMessage(m.id); })}
              className="-mt-1 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-black/5 hover:text-text"
              aria-label="Fermer ce message"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
