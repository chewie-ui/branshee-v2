"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronRight, Hammer, Plus, Search, Sparkles, Wand2, X } from "lucide-react";
import { AppIcon } from "@/components/apps/app-icon";
import { Button, ButtonLink } from "@/components/ui/button";
import { CATEGORY_LABEL, type AppCategory, type AppIcon as AppIconName, type AppId, type SkyApp } from "@/lib/apps";
import { fold, searchApps } from "@/lib/app-store";
import { cn } from "@/lib/cn";
import { setAppPinned } from "@/server/actions/apps";
import { useAppLocale, useT } from "@/components/app-locale";
import { CATEGORY_LABEL_EN } from "@/lib/apps-i18n";

type Item = { id: string; name: string; tagline: string; icon: AppIconName; href: string; billing: SkyApp["billing"]; category: AppCategory; installed: boolean; features: string[]; tags: string[]; slug: string | null; metiers: string[]; available: boolean; reach: "world" | "eu" | "be" };

const ORDER: AppCategory[] = ["clients", "finance", "operations", "equipe", "marketing", "services"];

/** App store de l'espace pro : recherche, filtre par métier, ajout / retrait, demandes sur mesure. */
export function AppStore({ items, canEdit, activeAddons, metiers, mine, country }: { items: Item[]; canEdit: boolean; activeAddons: string[]; metiers: { slug: string; nom: string }[]; mine: { slug: string; nom: string } | null; country: { name: string; canChange: boolean } }) {
  const router = useRouter();
  const t = useT();
  const locale = useAppLocale();
  const [q, setQ] = useState("");
  const [metier, setMetier] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [, start] = useTransition();
  const query = fold(q.trim());

  const shown = useMemo(() => {
    const pool = items.filter((a) => !metier || a.metiers.includes(metier));
    return query ? searchApps(pool as (Item & { id: AppId })[], query) : pool;
  }, [items, query, metier]);
  const filtering = !!query || !!metier;
  const installed = items.filter((a) => a.installed).length;

  const toggle = (a: Item, add: boolean) => {
    setBusy(a.id);
    setMsg(null);
    start(async () => {
      const r = await setAppPinned(a.id, add);
      setBusy(null);
      setMsg(r.ok ? { ok: true, text: add ? t("{app} est ajoutée à votre accueil.", { app: a.name }) : t("{app} est retirée de votre accueil.", { app: a.name }) } : { ok: false, text: r.error });
      router.refresh();
    });
  };

  const card = (a: Item) => {
    const addon = a.billing === "addon";
    return (
      <li key={a.id} className={cn("flex flex-col rounded-2xl border border-border bg-surface p-4", !a.available && "bg-surface-muted")}>
        <div className="flex items-start gap-3">
          <Link href={a.href} className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent" aria-label={t("Ouvrir {app}", { app: a.name })}><AppIcon icon={a.icon} /></Link>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              {a.name}
              {addon ? <span className={cn("rounded px-1.5 text-[11px] font-semibold", activeAddons.includes(a.id) ? "bg-success-soft text-success" : "bg-accent-soft text-accent-soft-foreground")}>{activeAddons.includes(a.id) ? t("Option active") : t("Option")}</span> : null}
            </p>
            <p className="text-sm text-muted">{a.tagline}</p>
          </div>
        </div>
        {a.tags.length ? (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t("Métiers concernés")}>
            {a.tags.slice(0, 4).map((tag) => <li key={tag} className="rounded-md bg-surface-muted px-2 py-0.5 text-xs text-muted">{tag}</li>)}
          </ul>
        ) : null}
        {a.features.length ? (
          <details className="group mt-3 text-sm">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-medium text-muted hover:text-text [&::-webkit-details-marker]:hidden">
              {t("Ce qu'elle fait")}<ChevronDown className="size-4 transition-transform duration-150 group-open:rotate-180" aria-hidden="true" />
            </summary>
            <ul className="mt-2 space-y-1.5">
              {a.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />{f}</li>)}
            </ul>
          </details>
        ) : null}
        {!a.available ? (
          <div className="mt-auto pt-4 text-sm">
            <p className="inline-flex rounded-md bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">{t("Pas disponible dans votre pays")}</p>
            <p className="mt-2 text-muted">{a.reach === "be" ? t("Cette app suit des règles propres à la Belgique (TVA, mentions légales, organismes belges). Une version pour votre pays peut être créée sur mesure.") : t("Cette app fonctionne avec des paiements en euros (zone euro). Une version pour votre pays peut être créée sur mesure.")}</p>
            <Link href={`/app/sur-mesure?app=${a.id}`} className="mt-2 inline-flex items-center gap-1 font-medium text-accent hover:text-accent-hover">{t("La demander pour mon pays")}<ChevronRight className="size-4" aria-hidden="true" /></Link>
          </div>
        ) : (
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          {a.installed ? (
            <>
              <ButtonLink href={a.href} size="sm">{t("Ouvrir")}</ButtonLink>
              {canEdit ? <Button size="sm" variant="ghost" loading={busy === a.id} onClick={() => toggle(a, false)} aria-label={t("Retirer {app} de l'accueil", { app: a.name })}>{t("Retirer")}</Button> : null}
            </>
          ) : canEdit ? (
            <Button size="sm" loading={busy === a.id} onClick={() => toggle(a, true)} icon={<Plus className="size-4" aria-hidden="true" />} aria-label={t("Ajouter {app}", { app: a.name })}>{t("Ajouter")}</Button>
          ) : (
            <ButtonLink href={a.href} size="sm" variant="secondary">{t("Voir")}</ButtonLink>
          )}
          {a.installed ? <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><Check className="size-3.5" aria-hidden="true" />{t("Installée")}</span> : null}
        </div>
        )}
        {a.available && a.billing === "included" ? (
          <Link href={`/app/sur-mesure?app=${a.id}`} className="group/p -mx-4 -mb-4 mt-4 flex items-center gap-2 rounded-b-2xl border-t border-border px-4 py-3 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-soft">
            <Wand2 className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{t("Personnaliser {app} à votre façon", { app: a.name })}</span>
            <ChevronRight className="size-4 shrink-0 transition-transform duration-150 group-hover/p:translate-x-0.5" aria-hidden="true" />
          </Link>
        ) : null}
      </li>
    );
  };

  const chip = (active: boolean) => cn("inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors duration-150", active ? "border-accent bg-accent text-accent-foreground" : "border-border-strong bg-surface hover:bg-surface-muted");

  return (
    <div className="mx-auto max-w-5xl">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("App store")}</h1>
        <p className="mt-1 text-sm text-muted">{t("Prenez les apps dont vous avez besoin : elles arrivent sur votre accueil. Toutes sont incluses, sauf les options.")} {t("{n} installée(s).", { n: installed }).replace("(s)", installed > 1 ? "s" : "")}</p>
        <p className="mt-1 text-xs text-muted">{t("Pays de l'entreprise : {country}.", { country: country.name })}{country.canChange ? <> <Link href="/app/reglages/etablissement#pays" className="font-medium text-accent hover:text-accent-hover">{t("Changer")}</Link></> : null}</p>
      </div>

      <div className="mx-auto mt-6 max-w-xl">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <label htmlFor="as-q" className="sr-only">{t("Rechercher une app ou un métier")}</label>
          <input id="as-q" type="text" inputMode="search" enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Rechercher : garagiste, caisse, devis, congés…")} autoComplete="off" className="h-12 w-full rounded-xl border border-border-strong bg-surface pr-11 pl-10 text-base focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/30" />
          {q ? <button type="button" onClick={() => setQ("")} className="absolute top-1/2 right-2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text" aria-label={t("Effacer la recherche")}><X className="size-4" aria-hidden="true" /></button> : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2" role="group" aria-label={t("Filtrer par métier")}>
        <button type="button" className={chip(!metier)} aria-pressed={!metier} onClick={() => setMetier(null)}>{t("Tous les métiers")}</button>
        {metiers.map((m) => (
          <button key={m.slug} type="button" className={chip(metier === m.slug)} aria-pressed={metier === m.slug} onClick={() => setMetier(metier === m.slug ? null : m.slug)}>
            {m.nom}{mine?.slug === m.slug ? <Sparkles className="ml-1.5 size-3.5" aria-label={t("(votre métier)")} /> : null}
          </button>
        ))}
      </div>

      {msg ? <p className={cn("mx-auto mt-5 max-w-xl rounded-lg px-3 py-2 text-center text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
      {!canEdit ? <p className="mx-auto mt-5 max-w-xl rounded-lg bg-surface-muted px-3 py-2 text-center text-sm text-muted">{t("Seul le responsable de l'entreprise peut ajouter ou retirer des apps.")}</p> : null}

      {/* Sur mesure : modifier une app ou en créer une de zéro. */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link href="/app/sur-mesure" className="group flex items-center gap-4 rounded-2xl border border-dashed border-border-strong bg-surface p-4 transition-colors duration-150 hover:border-accent hover:bg-accent-soft">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Hammer className="size-5" aria-hidden="true" /></span>
          <span><span className="block font-semibold">{t("Créer une app de zéro")}</span><span className="block text-sm text-muted">{t("Décrivez-la, on vous donne un prix fixe et on la construit.")}</span></span>
        </Link>
        <Link href="/app/sur-mesure" className="group flex items-center gap-4 rounded-2xl border border-dashed border-border-strong bg-surface p-4 transition-colors duration-150 hover:border-accent hover:bg-accent-soft">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent group-hover:bg-surface"><Wand2 className="size-5" aria-hidden="true" /></span>
          <span><span className="block font-semibold">{t("Personnaliser une app")}</span><span className="block text-sm text-muted">{t("On l'adapte à votre façon de travailler, rien que pour vous.")}</span></span>
        </Link>
      </div>

      {filtering ? (
        <section className="mt-10" aria-live="polite" aria-labelledby="as-res">
          <h2 id="as-res" className="text-lg font-semibold tracking-tight">{shown.length ? t("{n} app(s)", { n: shown.length }).replace("(s)", shown.length > 1 ? "s" : "") : t("Aucune app trouvée")}</h2>
          {!shown.length ? <p className="mt-1 text-sm text-muted">{t("Elle n'existe pas encore ?")} <Link href="/app/sur-mesure" className="font-medium text-accent hover:text-accent-hover">{t("Demandez-la, on la crée pour vous.")}</Link></p> : null}
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shown.map(card)}</ul>
        </section>
      ) : (
        ORDER.map((cat) => {
          const list = items.filter((a) => a.category === cat);
          if (!list.length) return null;
          return (
            <section key={cat} className="mt-10" aria-labelledby={`as-${cat}`}>
              <h2 id={`as-${cat}`} className="text-xs font-semibold tracking-wider text-muted uppercase">{(locale === "en" ? CATEGORY_LABEL_EN : CATEGORY_LABEL)[cat]}</h2>
              <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map(card)}</ul>
            </section>
          );
        })
      )}
    </div>
  );
}
