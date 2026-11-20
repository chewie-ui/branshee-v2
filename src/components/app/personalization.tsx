"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CalendarCheck, CalendarX, Check, MessageSquare, ShoppingBag, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { PREFS_STORAGE_KEY, prefsAttributes, type UiPrefs } from "@/lib/ui-prefs";
import { playSound, unlockAudioOnGesture } from "@/lib/ui-sounds";
import { fetchAppNotifications, markAppNotificationsRead, saveUiPrefs } from "@/server/actions/ui";
import { useT } from "@/components/app-locale";

type AppNotification = { id: string; kind: string; title: string; body: string; url: string | null; read: boolean; at: string };

type Ctx = {
  prefs: UiPrefs;
  update: (patch: Partial<UiPrefs>) => Promise<boolean>;
  items: AppNotification[];
  unread: number;
  markAllRead: () => void;
  /** Rejoue une notification d'essai (son, bulle, ordinateur) selon les réglages en cours. */
  test: (kind?: "booking" | "info") => void;
};
const PrefsContext = createContext<Ctx | null>(null);
export const usePersonalization = () => useContext(PrefsContext);

const POLL_MS = 30_000;
const isBooking = (kind: string) => kind === "booking";

/**
 * Personnalisation de l'espace pro : applique thème, couleur, curseur et confort sur <html>, et gère les notifications
 * (cloche, bulle dans le site, notification de l'ordinateur, son). Les nouvelles notifications sont relevées toutes les
 * 30 secondes tant qu'un onglet est ouvert.
 */
export function PersonalizationProvider({ initial, children }: { initial: UiPrefs; children: ReactNode }) {
  const [prefs, setPrefs] = useState(initial);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const router = useRouter();
  const t = useT();
  const prefsRef = useRef(prefs);
  const lastRef = useRef<string | null>(null);

  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  // Attributs sur <html> (le script de <head> pose la dernière copie locale avant l'affichage) ; retirés en quittant l'espace pro.
  useLayoutEffect(() => {
    const el = document.documentElement;
    const attrs = prefsAttributes(prefs);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(attrs));
    } catch {
      /* stockage indisponible : l'affichage sans flash attendra le chargement */
    }
    return () => {
      for (const k of Object.keys(attrs)) el.removeAttribute(k);
    };
  }, [prefs]);

  useEffect(() => unlockAudioOnGesture(), []);

  const announce = useCallback(
    (n: AppNotification) => {
      const p = prefsRef.current;
      if (p.sound) playSound(isBooking(n.kind) ? p.soundBooking : p.soundNotif, p.volume);
      const away = document.hidden || !document.hasFocus();
      if (p.notifDesktop && away && "Notification" in window && Notification.permission === "granted") {
        try {
          const desk = new Notification(n.title, { body: n.body, icon: "/skydev-icon-192.png", tag: n.id });
          desk.onclick = () => {
            window.focus();
            if (n.url) router.push(n.url);
            desk.close();
          };
        } catch {
          /* Notifications indisponibles (navigateur, mode privé) : la cloche suffit. */
        }
      }
      if (p.notifSite) {
        setToasts((l) => [n, ...l].slice(0, 3));
        setTimeout(() => setToasts((l) => l.filter((x) => x.id !== n.id)), 7000);
      }
    },
    [router],
  );

  const poll = useCallback(async () => {
    const r = await fetchAppNotifications(null).catch(() => null);
    if (!r) return;
    const newest = r.items[0]?.at ?? null;
    // Premier relevé : on affiche sans sonner ; ensuite, chaque nouvelle notification est annoncée.
    if (lastRef.current !== null) {
      const fresh = r.items.filter((i) => i.at > lastRef.current!).reverse();
      for (const n of fresh.slice(-3)) announce(n);
    }
    lastRef.current = newest ?? lastRef.current ?? "";
    setItems(r.items);
    setUnread(r.unread);
  }, [announce]);

  useEffect(() => {
    const first = setTimeout(() => void poll(), 0);
    const id = setInterval(() => {
      if (!document.hidden || prefsRef.current.notifDesktop || prefsRef.current.sound) void poll();
    }, POLL_MS);
    const onFocus = () => void poll();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [poll]);

  const update = useCallback(async (patch: Partial<UiPrefs>) => {
    setPrefs((p) => ({ ...p, ...patch }));
    const r = await saveUiPrefs(patch).catch(() => null);
    if (r?.ok) setPrefs(r.prefs);
    return !!r?.ok;
  }, []);

  const markAllRead = useCallback(() => {
    setUnread(0);
    setItems((l) => l.map((i) => ({ ...i, read: true })));
    void markAppNotificationsRead();
  }, []);

  const test = useCallback(
    (kind: "booking" | "info" = "booking") => {
      const n: AppNotification = { id: `test-${Date.now()}`, kind, title: kind === "booking" ? t("Nouveau rendez-vous") : t("Notification"), body: kind === "booking" ? t("Exemple : Sophie Martin · demain à 14h30") : t("Voici à quoi ressemblent vos notifications."), url: null, read: false, at: new Date().toISOString() };
      const p = prefsRef.current;
      if (p.sound) playSound(kind === "booking" ? p.soundBooking : p.soundNotif, p.volume);
      if (p.notifDesktop && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(n.title, { body: n.body, icon: "/skydev-icon-192.png" });
        } catch {
          /* rien */
        }
      }
      if (p.notifSite) {
        setToasts((l) => [n, ...l].slice(0, 3));
        setTimeout(() => setToasts((l) => l.filter((x) => x.id !== n.id)), 7000);
      }
    },
    [t],
  );

  return (
    <PrefsContext.Provider value={{ prefs, update, items, unread, markAllRead, test }}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {toasts.map((n) => (
          <div key={n.id} role="status" className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-lg">
            <KindIcon kind={n.kind} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="mt-0.5 text-sm text-muted">{n.body}</p>
              {n.url ? <Link href={n.url} className="mt-1 inline-block text-sm font-medium text-accent hover:text-accent-hover" onClick={() => setToasts((l) => l.filter((x) => x.id !== n.id))}>{t("Voir")}</Link> : null}
            </div>
            <button type="button" className="-m-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label={t("Fermer")} onClick={() => setToasts((l) => l.filter((x) => x.id !== n.id))}>
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </PrefsContext.Provider>
  );
}

function KindIcon({ kind }: { kind: string }) {
  const Icon = kind === "booking" ? CalendarCheck : kind === "cancellation" ? CalendarX : kind === "order" ? ShoppingBag : kind === "message" ? MessageSquare : Bell;
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", kind === "cancellation" ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent-soft-foreground")} aria-hidden="true">
      <Icon className="size-4" />
    </span>
  );
}

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short" }).format(new Date(iso));
};

/** Cloche des notifications (liste des dernières, « tout marquer comme lu »). `align` : côté d'ouverture du panneau. */
export function NotificationBell({ align = "right", className }: { align?: "left" | "right"; className?: string }) {
  const ctx = usePersonalization();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (!ctx) return null;
  const { items, unread, markAllRead } = ctx;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={unread ? t("Notifications, {n} non lue(s)", { n: unread }) : t("Notifications")}
        className={cn("relative flex size-10 items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-surface-muted hover:text-text", className)}
      >
        <Bell className="size-5 sm:size-4" aria-hidden="true" />
        {unread ? <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] leading-4 font-semibold text-accent-foreground" aria-hidden="true">{unread > 9 ? "9+" : unread}</span> : null}
      </button>
      {open ? (
        <div className={cn("fixed inset-x-4 top-16 z-50 overflow-hidden rounded-xl border border-border bg-surface shadow-xl sm:absolute sm:inset-x-auto sm:top-full sm:mt-2 sm:w-[22rem]", align === "right" ? "sm:right-0" : "sm:left-0")} role="dialog" aria-label={t("Notifications")}>
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">{t("Notifications")}</p>
            {unread ? (
              <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover">
                <Check className="size-4" aria-hidden="true" />
                {t("Tout marquer comme lu")}
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">{t("Aucune notification pour l'instant. Les nouveaux rendez-vous, annulations, commandes et messages apparaîtront ici.")}</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
              {items.map((n) => {
                const body = (
                  <>
                    <KindIcon kind={n.kind} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={cn("truncate text-sm", n.read ? "font-medium" : "font-semibold")}>{n.title}</span>
                        {!n.read ? <span className="size-2 shrink-0 rounded-full bg-accent" aria-label={t("non lue")} /> : null}
                      </span>
                      <span className="block truncate text-sm text-muted">{n.body}</span>
                      <span className="block text-xs text-muted">{ago(n.at)}</span>
                    </span>
                  </>
                );
                return (
                  <li key={n.id}>
                    {n.url ? (
                      <Link href={n.url} onClick={() => setOpen(false)} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-muted">{body}</Link>
                    ) : (
                      <div className="flex items-start gap-3 px-4 py-3">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/app/reglages/personnalisation" onClick={() => setOpen(false)} className="block border-t border-border px-4 py-2.5 text-center text-sm font-medium text-muted hover:bg-surface-muted hover:text-text">{t("Sons et notifications")}</Link>
        </div>
      ) : null}
    </div>
  );
}
