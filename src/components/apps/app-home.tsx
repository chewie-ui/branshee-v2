"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Minus, Pin, Plus, SlidersHorizontal, Wand2 } from "lucide-react";
import type { VisibleApp } from "@/server/apps";
import { AppIcon } from "@/components/apps/app-icon";
import { Button, ButtonLink } from "@/components/ui/button";
import { CATEGORY_LABEL, type AppCategory, type AppIcon as AppIconName } from "@/lib/apps";
import { cn } from "@/lib/cn";
import { setAppPinned, setFavoriteApp } from "@/server/actions/apps";

const ORDER: AppCategory[] = ["clients", "finance", "equipe", "operations", "marketing", "services"];

function tagOf(app: VisibleApp, activeAddons: string[]) {
  if (app.status === "soon") return { text: "Bientôt", cls: "bg-warning-soft text-warning" };
  if (app.billing === "addon") return activeAddons.includes(app.id) ? { text: "Actif", cls: "bg-success-soft text-success" } : { text: "Option", cls: "bg-accent-soft text-accent-soft-foreground" };
  if (app.billing === "quote") return { text: "Sur devis", cls: "bg-accent-soft text-accent-soft-foreground" };
  return null;
}

/**
 * Accueil Skydev : les apps de l'entreprise en grandes icônes (comme un écran de téléphone),
 * puis le catalogue des autres apps, à ajouter en un clic. Le responsable peut ranger son accueil.
 */
export function AppHome({ apps, activeAddons, canEdit, admin = [] }: { apps: VisibleApp[]; activeAddons: string[]; canEdit: boolean; admin?: { href: string; label: string; hint: string; icon: AppIconName }[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const pinned = apps.filter((a) => a.pinned);
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
          <h2 id="admin-h" className="mb-3 text-center text-sm font-semibold tracking-wide text-muted uppercase">Administration</h2>
          {/* Cartes centrées : une rangée incomplète reste au milieu. */}
          <ul className="flex flex-wrap justify-center gap-3">
            {admin.map((a) => (
              <li key={a.href} className="w-[calc(50%-0.375rem)] min-w-0 sm:w-[calc(33.333%-0.5rem)] lg:w-[calc(16.666%-0.625rem)]">
                <Link href={a.href} className="flex h-full min-w-0 items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors duration-150 hover:border-accent lg:flex-col lg:items-stretch">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><AppIcon icon={a.icon} className="size-5" /></span>
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{a.label}</span><span className="line-clamp-2 block text-xs text-muted">{a.hint}</span></span>
                </Link>
              </li>
            ))}
          </ul>
          <h2 className="mt-10 mb-1 text-center text-sm font-semibold tracking-wide text-muted uppercase">Applications</h2>
          <p className="mb-2 text-center text-xs text-muted">Épinglez les apps que vous utilisez le plus : elles passent en premier et deviennent des raccourcis dans chaque app.</p>
        </section>
      ) : null}
      <ul className="grid grid-cols-3 gap-x-3 gap-y-8 sm:grid-cols-4 sm:gap-x-6 lg:grid-cols-5">
        {pinned.map((app) => {
          const tag = tagOf(app, activeAddons);
          const removable = editing && app.id !== "reglages";
          return (
            <li key={app.id} className="group/tile relative">
              <Link href={app.href} className="group flex flex-col items-center gap-2.5 rounded-2xl p-2 text-center outline-offset-4">
                <span className="relative flex size-16 items-center justify-center rounded-2xl border border-border bg-surface text-accent shadow-sm transition-[transform,box-shadow,border-color] duration-150 group-hover:-translate-y-0.5 group-hover:border-border-strong group-hover:shadow-md sm:size-20">
                  <AppIcon icon={app.icon} className="size-7 sm:size-8" />
                </span>
                <span className="text-sm font-medium text-text">{app.name}</span>
                {tag ? <span className={`-mt-1.5 rounded px-1.5 text-[11px] font-semibold ${tag.cls}`}>{tag.text}</span> : null}
              </Link>
              {!removable && app.id !== "reglages" ? (
                <button
                  type="button"
                  onClick={() => favToggle(app.id, !app.fav)}
                  disabled={busy === app.id}
                  aria-pressed={app.fav}
                  aria-label={app.fav ? `Désépingler ${app.name}` : `Épingler ${app.name} en premier`}
                  title={app.fav ? "Épinglée : cliquez pour la désépingler" : "Épingler en premier"}
                  className={cn(
                    "absolute top-0 left-1/2 ml-6 flex size-7 items-center justify-center rounded-full border shadow-sm transition-opacity duration-150 disabled:opacity-50 sm:ml-8",
                    app.fav ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface text-muted opacity-60 hover:text-accent focus-visible:opacity-100 sm:opacity-0 sm:group-hover/tile:opacity-100",
                  )}
                >
                  <Pin className={cn("size-3.5", app.fav && "fill-current")} aria-hidden="true" />
                </button>
              ) : null}
              {removable ? (
                <button type="button" onClick={() => toggle(app.id, false)} disabled={busy === app.id} aria-label={`Retirer ${app.name} de l'accueil`} className="absolute top-0 left-1/2 ml-6 flex size-7 items-center justify-center rounded-full border border-border bg-surface text-danger shadow-sm hover:bg-danger-soft disabled:opacity-50 sm:ml-8">
                  <Minus className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {canEdit ? (
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button variant="secondary" size="sm" icon={<SlidersHorizontal className="size-4" aria-hidden="true" />} onClick={() => setEditing((v) => !v)} aria-pressed={editing}>
            {editing ? "Terminé" : "Modifier l'accueil"}
          </Button>
          <ButtonLink href="/app/demarrer" variant="ghost" size="sm">Refaire le questionnaire</ButtonLink>
        </div>
      ) : null}

      {/* Sur mesure : demander n'importe quelle modif d'une app, ou une app nouvelle. */}
      <Link href="/app/sur-mesure" className="group mx-auto mt-12 flex max-w-3xl items-center gap-4 rounded-2xl border border-dashed border-border-strong bg-surface p-5 transition-colors duration-150 hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent group-hover:bg-surface" aria-hidden="true"><Wand2 className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Il vous manque quelque chose ?</span>
          <span className="block text-sm text-muted">Une modif dans n&apos;importe quelle app, ou une app entièrement nouvelle pour votre métier : décrivez-la, on vous donne un prix fixe et on la construit.</span>
        </span>
        <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-accent sm:inline-flex">Sur mesure<ArrowRight className="size-4" aria-hidden="true" /></span>
        <ArrowRight className="size-5 shrink-0 text-accent sm:hidden" aria-hidden="true" />
      </Link>

      {others.length ? (
        <section className="mt-12" aria-labelledby="more-apps">
          <h2 id="more-apps" className="text-lg font-semibold tracking-tight">Ajouter des apps</h2>
          <p className="mt-1 text-sm text-muted">Toutes sont incluses dans votre abonnement, sauf les options. Ajoutez-les à votre accueil quand vous en avez besoin.</p>
          <div className="mt-6 space-y-8">
            {ORDER.map((cat) => {
              const list = others.filter((a) => a.category === cat);
              if (!list.length) return null;
              return (
                <div key={cat}>
                  <h3 className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">{CATEGORY_LABEL[cat]}</h3>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {list.map((app) => {
                      const tag = tagOf(app, activeAddons);
                      return (
                        <li key={app.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface p-3">
                          <Link href={app.href} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-offset-2">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><AppIcon icon={app.icon} /></span>
                            <span className="min-w-0">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{app.name}</span>
                                {tag ? <span className={cn("rounded px-1.5 text-[11px] font-semibold", tag.cls)}>{tag.text}</span> : null}
                              </span>
                              <span className="block truncate text-sm text-muted">{app.tagline}</span>
                            </span>
                          </Link>
                          {canEdit ? (
                            <Button size="sm" variant="secondary" loading={busy === app.id} onClick={() => toggle(app.id, true)} aria-label={`Ajouter ${app.name} à l'accueil`} icon={<Plus className="size-4" aria-hidden="true" />}>
                              Ajouter
                            </Button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
