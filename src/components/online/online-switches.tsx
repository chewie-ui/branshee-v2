"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Power } from "lucide-react";
import { cn } from "@/lib/cn";
import { setOnline } from "@/server/actions/online";
import { useT } from "@/components/app-locale";
import type { OnlineItem, OnlineKind } from "@/server/online";

/** Interrupteur En ligne / Coupé, avec un libellé clair et accessible. */
function Switch({ on, pending, onToggle, label }: { on: boolean; pending: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={pending} onClick={onToggle} className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 disabled:cursor-wait disabled:opacity-60", on ? "bg-success" : "bg-border-strong")}>
      <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow ring-1 ring-black/5 transition-transform duration-150", on && "translate-x-5")} />
    </button>
  );
}

function useToggle() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const toggle = (kind: OnlineKind, on: boolean) =>
    start(async () => {
      const r = await setOnline(kind, on);
      setMsg({ ok: r.ok, text: (r.ok ? r.message : r.error) ?? "" });
      router.refresh();
    });
  return { pending, msg, toggle };
}

/** Carte « En ligne » : toutes les pages publiques de l'établissement, chacune avec son interrupteur. */
export function OnlineSwitches({ items }: { items: OnlineItem[] }) {
  const t = useT();
  const { pending, msg, toggle } = useToggle();
  return (
    <div>
      <ul className="divide-y divide-border">
        {items.map((i) => (
          <li key={i.kind} className="flex items-center gap-3 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <Link href={i.settingsHref} className="text-sm font-medium hover:text-accent">{t(i.label)}</Link>
              <p className={cn("text-xs", i.on ? "text-success" : "text-muted")}>{i.on ? t("En ligne") : t("Coupé")}</p>
            </div>
            <Switch on={i.on} pending={pending} label={t("{label} : en ligne", { label: t(i.label) })} onToggle={() => toggle(i.kind, !i.on)} />
          </li>
        ))}
      </ul>
      {msg ? <p className={cn("px-5 pb-4 text-sm", msg.ok ? "text-success" : "text-danger")} role={msg.ok ? "status" : "alert"}>{t(msg.text)}</p> : null}
    </div>
  );
}

/** Interrupteur seul, pour l'en-tête d'une page (page de réservation, site, boutique). */
export function OnlineToggle({ item }: { item: OnlineItem }) {
  const t = useT();
  const { pending, msg, toggle } = useToggle();
  return (
    <div className="flex flex-col items-end gap-1">
      <div className={cn("inline-flex min-h-11 items-center gap-3 rounded-lg border px-3 py-1.5", item.on ? "border-success/40 bg-success-soft" : "border-border-strong bg-surface")}>
        <Power className={cn("size-4", item.on ? "text-success" : "text-muted")} aria-hidden="true" />
        <span className="text-sm font-medium">{item.on ? t("En ligne") : t("Coupé")}</span>
        <Switch on={item.on} pending={pending} label={t("{label} : en ligne", { label: t(item.label) })} onToggle={() => toggle(item.kind, !item.on)} />
      </div>
      {msg ? <p className={cn("max-w-xs text-right text-xs", msg.ok ? "text-success" : "text-danger")} role={msg.ok ? "status" : "alert"}>{t(msg.text)}</p> : !item.on ? <p className="max-w-xs text-right text-xs text-muted">{t(item.hint)}</p> : null}
    </div>
  );
}
