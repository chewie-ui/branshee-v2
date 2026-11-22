"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Minus, Pin, Plus, SlidersHorizontal, Wand2 } from "lucide-react";
import type { VisibleApp } from "@/server/apps";
import { AppIcon } from "@/components/apps/app-icon";
import { Button, ButtonLink } from "@/components/ui/button";
import type { AppIcon as AppIconName } from "@/lib/apps";
import { cn } from "@/lib/cn";
import { setAppOrder, setAppPinned, setFavoriteApp } from "@/server/actions/apps";
import { useT } from "@/components/app-locale";
import type { T } from "@/lib/i18n/app";

function tagOf(app: VisibleApp, activeAddons: string[], t: T) {
  if (app.status === "soon") return { text: t("Bientôt"), cls: "bg-warning-soft text-warning" };
  if (app.billing === "addon") return activeAddons.includes(app.id) ? { text: t("Actif"), cls: "bg-success-soft text-success" } : { text: t("Option"), cls: "bg-accent-soft text-accent-soft-foreground" };
  if (app.billing === "quote") return { text: t("Sur devis"), cls: "bg-accent-soft text-accent-soft-foreground" };
  return null;
}

/**
 * Accueil Skydev : les apps de l'entreprise en grandes icônes (comme un écran de téléphone),
 * puis la tuile « App store » pour en ajouter d'autres. Le responsable peut ranger son accueil.
 */
export function AppHome({ apps, activeAddons, canEdit, admin = [], afterApps, footer }: { apps: VisibleApp[]; activeAddons: string[]; canEdit: boolean; admin?: { href: string; label: string; hint: string; icon: AppIconName }[]; afterApps?: ReactNode; footer?: ReactNode }) {
  const router = useRouter();
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const pinnedRaw = apps.filter((a) => a.pinned);
  // Glisser-déposer (mode « Modifier l'accueil ») : ordre local pendant le geste, enregistré au relâchement.
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const startOrder = useRef<string[]>([]);
  const pinned = order ? [...order.map((id) => pinnedRaw.find((a) => a.id === id)).filter((a): a is VisibleApp => !!a), ...pinnedRaw.filter((a) => !order.includes(a.id))] : pinnedRaw;
  const saveOrder = (ids: string[]) => {
    if (ids.join() === pinnedRaw.map((a) => a.id).join()) return setOrder(null);
    start(async () => {
      await setAppOrder(ids);
      router.refresh();
    });
  };
  const onPointerDown = (e: React.PointerEvent, id: string) => {
    if (!editing || (e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startOrder.current = pinned.map((a) => a.id as string);
    setOrder(startOrder.current);
    setDragId(id);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragId) return;
    const over = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-app-id]")?.dataset.appId;
    if (!over || over === dragId) return;
    setOrder((cur) => {
      const list = [...(cur ?? startOrder.current)];
      const from = list.indexOf(dragId), to = list.indexOf(over);
      if (from < 0 || to < 0) return cur;
      list.splice(from, 1);
      list.splice(to, 0, dragId);
      return list;
    });
  };
  const onPointerUp = () => {
    if (!dragId) return;
    setDragId(null);
    if (order) saveOrder(order);
  };
  // Clavier : flèches gauche / droite sur une app en mode édition.
  const moveBy = (id: string, delta: number) => {
    const list: string[] = pinned.map((a) => a.id);
    const i = list.indexOf(id), j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    list.splice(i, 1);
    list.splice(j, 0, id);
    setOrder(list);
    saveOrder(list);
  };
  const others = apps.filter((a) => !a.pinned);
  const favToggle = (id: string, fav: boolean) => {
    setBusy(id);
    start(async () => {
      await setFavoriteApp(id, fav);
      setBusy(null);
      router.refresh();
    });
  };
  const toggle = (id: string, pin: boolean) => {
    setBusy(id);
    start(async () => {
      await setAppPinned(id, pin);
      setBusy(null);
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-4xl">
      {admin.length ? (
        <section aria-labelledby="admin-h" className="mb-10">
          <h2 id="admin-h" className="mb-3 text-center text-sm font-semibold tracking-wide text-muted uppercase">{t("Administration")}</h2>
          {/* Cartes centrées : une rangée incomplète reste au milieu. */}
          <ul className="flex flex-wrap justify-center gap-3">
            {admin.map((a) => (
              <li key={a.href} className="w-[calc(50%-0.375rem)] min-w-0 sm:w-[calc(33.333%-0.5rem)] lg:w-[calc(16.666%-0.625rem)]">
                <Link href={a.href} className="flex h-full min-w-0 items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors duration-150 hover:border-accent lg:flex-col lg:items-stretch">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><AppIcon icon={a.icon} className="size-5" /></span>
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{t(a.label)}</span><span className="line-clamp-2 block text-xs text-muted">{t(a.hint)}</span></span>
                </Link>
              </li>
            ))}
          </ul>
          <h2 className="mt-10 text-center text-sm font-semibold tracking-wide text-muted uppercase">{t("Applications")}</h2>
        </section>
      ) : null}
      <ul className="grid grid-cols-3 gap-x-3 gap-y-8 sm:grid-cols-4 sm:gap-x-6 lg:grid-cols-5">
        {pinned.map((app) => {
          const tag = tagOf(app, activeAddons, t);
          const removable = editing && app.id !== "reglages";
          return (
            <li
              key={app.id}
              data-app-id={app.id}
              className={cn("group/tile relative", editing && "touch-none select-none", dragId === app.id && "z-10 scale-105 opacity-80")}
              onPointerDown={(e) => onPointerDown(e, app.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {editing ? (
                <div
                  tabIndex={0}
                  role="button"
                  aria-roledescription={t("app déplaçable")}
                  aria-label={t("{app} : glissez, ou flèches gauche et droite pour déplacer", { app: app.name })}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); moveBy(app.id, -1); }
                    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); moveBy(app.id, 1); }
                  }}
                  className={cn("group flex cursor-grab flex-col items-center gap-2.5 rounded-2xl p-2 text-center outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent", dragId === app.id && "cursor-grabbing")}
                >
                <span className="relative flex size-16 items-center justify-center rounded-2xl border border-border bg-surface text-accent shadow-sm transition-[transform,box-shadow,border-color] duration-150 group-hover:-translate-y-0.5 group-hover:border-border-strong group-hover:shadow-md sm:size-20">
                  <AppIcon icon={app.icon} className="size-7 sm:size-8" />
                </span>
                <span className="text-sm font-medium text-text">{app.name}</span>
                {tag ? <span className={`-mt-1.5 rounded px-1.5 text-[11px] font-semibold ${tag.cls}`}>{t(tag.text)}</span> : null}
                </div>
              ) : (
              <Link href={app.href} className="group flex flex-col items-center gap-2.5 rounded-2xl p-2 text-center outline-offset-4">
                <span className="relative flex size-16 items-center justify-center rounded-2xl border border-border bg-surface text-accent shadow-sm transition-[transform,box-shadow,border-color] duration-150 group-hover:-translate-y-0.5 group-hover:border-border-strong group-hover:shadow-md sm:size-20">
                  <AppIcon icon={app.icon} className="size-7 sm:size-8" />
                </span>
                <span className="text-sm font-medium text-text">{app.name}</span>
                {tag ? <span className={`-mt-1.5 rounded px-1.5 text-[11px] font-semibold ${tag.cls}`}>{t(tag.text)}</span> : null}
              </Link>
              )}
              {!removable && app.id !== "reglages" ? (
                <button
                  type="button"
                  onClick={() => favToggle(app.id, !app.fav)}
                  disabled={busy === app.id}
                  aria-pressed={app.fav}
                  aria-label={app.fav ? t("Désépingler {app}", { app: app.name }) : t("Épingler {app} en premier", { app: app.name })}
                  title={app.fav ? t("Épinglée : cliquez pour la désépingler") : t("Épingler en premier")}
                  className={cn(
                    "absolute top-0 left-1/2 ml-6 flex size-7 items-center justify-center rounded-full border shadow-sm transition-opacity duration-150 disabled:opacity-50 sm:ml-8",
                    app.fav ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface text-muted opacity-60 hover:text-accent focus-visible:opacity-100 sm:opacity-0 sm:group-hover/tile:opacity-100",
                  )}
                >
                  <Pin className={cn("size-3.5", app.fav && "fill-current")} aria-hidden="true" />
                </button>
              ) : null}
              {removable ? (
                <button type="button" onClick={() => toggle(app.id, false)} disabled={busy === app.id} aria-label={t("Retirer {app} de l'accueil", { app: app.name })} className="absolute top-0 left-1/2 ml-6 flex size-7 items-center justify-center rounded-full border border-border bg-surface text-danger shadow-sm hover:bg-danger-soft disabled:opacity-50 sm:ml-8">
                  <Minus className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </li>
          );
        })}
        <li>
          <Link href="/app/apps" className="group flex flex-col items-center gap-2.5 rounded-2xl p-2 text-center outline-offset-4">
            <span className="relative flex size-16 items-center justify-center rounded-2xl border border-dashed border-accent/50 bg-accent-soft text-accent transition-[transform,border-color] duration-150 group-hover:-translate-y-0.5 group-hover:border-accent sm:size-20">
              <Plus className="size-7 sm:size-8" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium text-text">{t("App store")}</span>
            {others.length ? <span className="-mt-1.5 text-[11px] text-muted">{t("{n} à découvrir", { n: others.length })}</span> : null}
          </Link>
        </li>
      </ul>

      {editing ? <p className="mt-6 text-center text-sm text-muted">{t("Glissez les apps pour changer leur ordre. Le « − » les retire de l'accueil.")}</p> : null}
      {canEdit ? (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <Button variant="secondary" size="sm" icon={<SlidersHorizontal className="size-4" aria-hidden="true" />} onClick={() => { setEditing((v) => !v); setOrder(null); }} aria-pressed={editing}>
            {editing ? t("Terminé") : t("Modifier l'accueil")}
          </Button>
          <ButtonLink href="/app/demarrer" variant="ghost" size="sm">{t("Refaire le questionnaire")}</ButtonLink>
        </div>
      ) : null}

      {afterApps ? <div className="mt-12">{afterApps}</div> : null}


      {/* Sur mesure : demander n'importe quelle modif d'une app, ou une app nouvelle. */}
      <Link href="/app/sur-mesure" className="group mx-auto mt-12 flex max-w-3xl items-center gap-4 rounded-2xl border border-dashed border-border-strong bg-surface p-5 transition-colors duration-150 hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent group-hover:bg-surface" aria-hidden="true"><Wand2 className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t("Il vous manque quelque chose ?")}</span>
          <span className="block text-sm text-muted">{t("Une modif dans une app, ou une app créée de zéro pour votre métier : prix fixe, on la construit.")}</span>
        </span>
        <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-accent sm:inline-flex">{t("Sur mesure")}<ArrowRight className="size-4" aria-hidden="true" /></span>
        <ArrowRight className="size-5 shrink-0 text-accent sm:hidden" aria-hidden="true" />
      </Link>
      {footer}

    </div>
  );
}
