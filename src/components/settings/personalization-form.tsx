"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Monitor, Moon, Play, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { ACCENTS, CURSORS, SOUNDS, THEMES, type SoundId, type UiPrefs } from "@/lib/ui-prefs";
import { playSound } from "@/lib/ui-sounds";
import { usePersonalization } from "@/components/app/personalization";
import { useT } from "@/components/app-locale";

const cursorUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
const noop = () => () => {};
const permission = (): NotificationPermission | "unsupported" => ("Notification" in window ? Notification.permission : "unsupported");
const THEME_ICON = { light: Sun, dark: Moon, auto: Monitor } as const;

function Switch({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        {hint ? <p className="mt-0.5 text-sm text-muted">{hint}</p> : null}
      </div>
      <button id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-150", checked ? "bg-accent" : "bg-border-strong")}>
        <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow ring-1 ring-black/5 transition-transform duration-150", checked && "translate-x-5")} />
      </button>
    </div>
  );
}

/**
 * Réglages › Personnalisation : thème, couleur, curseur, notifications, sons et confort.
 * Chaque changement s'applique tout de suite et est enregistré pour l'utilisateur (tous ses appareils).
 */
export function PersonalizationForm({ notifications = true }: { notifications?: boolean }) {
  const ctx = usePersonalization();
  const t = useT();
  // Autorisation du navigateur, relue à chaque affichage (« default » côté serveur).
  const [, refresh] = useState(0);
  const perm = useSyncExternalStore(noop, permission, () => "default" as const);
  const [saved, setSaved] = useState<"ok" | "error" | null>(null);
  if (!ctx) return null;
  const { prefs, test } = ctx;
  const set = async (patch: Partial<UiPrefs>) => {
    setSaved(null);
    setSaved((await ctx.update(patch)) ? "ok" : "error");
  };

  const toggleDesktop = async (on: boolean) => {
    if (!on) return set({ notifDesktop: false });
    if (perm === "unsupported") return;
    let p: NotificationPermission = Notification.permission;
    if (p === "default") p = await Notification.requestPermission();
    refresh((n) => n + 1);
    if (p === "granted") await set({ notifDesktop: true });
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted" role="status" aria-live="polite">
        {saved === "error" ? <span className="text-danger">{t("Pas pu enregistrer : vérifiez votre connexion et réessayez.")}</span> : saved === "ok" ? t("Enregistré. Ces réglages sont à vous : chaque membre de l'équipe a les siens, sur tous ses appareils.") : t("Ces réglages sont à vous : chaque membre de l'équipe a les siens, sur tous ses appareils.")}
      </p>

      <Card>
        <CardHeader title={t("Apparence")} description={t("Le thème et la couleur de votre espace.")} />
        <div className="space-y-6 p-5">
          <fieldset>
            <legend className="mb-3 text-sm font-medium">{t("Thème")}</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {THEMES.map((th) => {
                const Icon = THEME_ICON[th.id];
                const on = prefs.theme === th.id;
                return (
                  <label key={th.id} className={cn("flex cursor-pointer flex-col gap-3 rounded-xl border-2 p-3 transition-colors duration-150", on ? "border-accent" : "border-border hover:border-border-strong")}>
                    <input type="radio" name="theme" value={th.id} checked={on} onChange={() => set({ theme: th.id })} className="sr-only" />
                    <span className="flex h-20 overflow-hidden rounded-lg border border-border" aria-hidden="true">
                      {th.id === "auto" ? (
                        <>
                          <ThemePreview dark={false} half />
                          <ThemePreview dark half />
                        </>
                      ) : (
                        <ThemePreview dark={th.id === "dark"} />
                      )}
                    </span>
                    <span className="flex items-center gap-2 text-sm font-medium"><Icon className="size-4 text-muted" aria-hidden="true" />{t(th.label)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-3 text-sm font-medium">{t("Couleur")}</legend>
            <div className="flex flex-wrap gap-3">
              {ACCENTS.map((a) => {
                const on = prefs.accent === a.id;
                return (
                  <label key={a.id} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 py-1.5 pr-4 pl-1.5 text-sm font-medium transition-colors duration-150", on ? "border-accent" : "border-border hover:border-border-strong")}>
                    <input type="radio" name="accent" value={a.id} checked={on} onChange={() => set({ accent: a.id })} className="sr-only" />
                    <span className="size-7 rounded-full ring-2 ring-surface" style={{ background: a.swatch }} aria-hidden="true" />
                    {t(a.label)}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      </Card>

      <Card>
        <CardHeader title={t("Curseur de la souris")} description={t("Survolez un curseur pour l'essayer, cliquez pour le garder.")} />
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
          {CURSORS.map((c) => {
            const on = prefs.cursor === c.id;
            return (
              <label key={c.id} style={c.arrow ? { cursor: `${cursorUrl(c.arrow.svg)} ${c.arrow.x} ${c.arrow.y}, auto` } : { cursor: "default" }} className={cn("flex min-h-28 flex-col items-center justify-center gap-3 rounded-xl border-2 p-3 text-center transition-colors duration-150", on ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong")}>
                <input type="radio" name="cursor" value={c.id} checked={on} onChange={() => set({ cursor: c.id })} className="sr-only" />
                <span className="flex h-12 items-center justify-center" aria-hidden="true">
                  {c.arrow ? (
                    // eslint-disable-next-line @next/next/no-img-element -- petit dessin SVG en ligne
                    <img src={`data:image/svg+xml,${encodeURIComponent(c.arrow.svg)}`} alt="" className="max-h-12" />
                  ) : (
                    <svg width="28" height="28" viewBox="0 0 32 32"><path d="M5 3v22l6-6 4.2 9.3 3.8-1.7L14.8 17.6H23z" fill="var(--text)" stroke="var(--surface)" strokeWidth="1.8" strokeLinejoin="round" /></svg>
                  )}
                </span>
                <span className="text-sm font-medium">{t(c.label)}</span>
              </label>
            );
          })}
        </div>
      </Card>

      {notifications ? (<>
      <Card>
        <CardHeader title={t("Notifications")} description={t("Nouveaux rendez-vous, demandes, annulations, commandes de la boutique et messages de votre site. Elles arrivent aussi dans la cloche, en haut de l'écran.")} />
        <div className="divide-y divide-border px-5">
          <Switch id="notif-site" checked={prefs.notifSite} onChange={(v) => set({ notifSite: v })} label={t("Bulle dans le site")} hint={t("Un petit message en bas de l'écran quand quelque chose arrive.")} />
          <Switch
            id="notif-desktop"
            checked={prefs.notifDesktop && perm === "granted"}
            onChange={toggleDesktop}
            label={t("Notifications sur l'ordinateur")}
            hint={
              perm === "unsupported"
                ? t("Votre navigateur ne permet pas les notifications.")
                : perm === "denied"
                  ? t("Bloquées par le navigateur : cliquez sur le cadenas à gauche de l'adresse, puis autorisez les notifications.")
                  : t("Une notification de Windows ou du Mac, même quand vous êtes dans un autre onglet ou une autre fenêtre (tant qu'un onglet Skydev reste ouvert).")
            }
          />
          <div className="flex flex-wrap gap-2 py-4">
            <Button variant="secondary" size="sm" icon={<Play className="size-4" aria-hidden="true" />} onClick={() => test("booking")}>{t("Tester une notification")}</Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title={t("Sons")} description={t("Un son quand une notification arrive, différent pour les nouveaux rendez-vous.")} />
        <div className="divide-y divide-border px-5">
          <Switch id="sound" checked={prefs.sound} onChange={(v) => set({ sound: v })} label={t("Jouer un son")} />
          <div className={cn("space-y-4 py-4", !prefs.sound && "pointer-events-none opacity-50")} aria-disabled={!prefs.sound}>
            <div>
              <label htmlFor="volume" className="text-sm font-medium">{t("Volume")}</label>
              <div className="mt-2 flex items-center gap-3">
                <input id="volume" type="range" min={0} max={100} step={5} value={prefs.volume} disabled={!prefs.sound} onChange={(e) => ctx.update({ volume: Number(e.target.value) })} onPointerUp={() => playSound(prefs.soundNotif, prefs.volume)} className="h-11 w-full max-w-xs accent-[var(--accent)]" />
                <span className="w-12 text-sm text-muted tabular-nums">{prefs.volume} %</span>
              </div>
            </div>
            <SoundPick id="sound-booking" label={t("Nouveau rendez-vous")} value={prefs.soundBooking} volume={prefs.volume} disabled={!prefs.sound} onChange={(v) => set({ soundBooking: v })} />
            <SoundPick id="sound-notif" label={t("Autres notifications")} value={prefs.soundNotif} volume={prefs.volume} disabled={!prefs.sound} onChange={(v) => set({ soundNotif: v })} />
          </div>
        </div>
      </Card>

      </>) : null}

      <Card>
        <CardHeader title={t("Confort")} />
        <div className="divide-y divide-border px-5">
          <Switch id="text-large" checked={prefs.textSize === "large"} onChange={(v) => set({ textSize: v ? "large" : "normal" })} label={t("Texte plus grand")} hint={t("Tout l'espace un peu plus grand, plus facile à lire.")} />
          <Switch id="reduce-motion" checked={prefs.reduceMotion} onChange={(v) => set({ reduceMotion: v })} label={t("Réduire les animations")} hint={t("Moins de mouvements à l'écran.")} />
        </div>
      </Card>
    </div>
  );
}

function SoundPick({ id, label, value, volume, disabled, onChange }: { id: string; label: string; value: SoundId; volume: number; disabled: boolean; onChange: (v: SoundId) => void }) {
  const t = useT();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <div className="mt-2 flex items-center gap-2">
        <Select id={id} value={value} disabled={disabled} onChange={(e) => { const v = e.target.value as SoundId; onChange(v); playSound(v, volume); }} className="max-w-xs">
          {SOUNDS.map((s) => <option key={s.id} value={s.id}>{t(s.label)}</option>)}
        </Select>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} aria-label={t("Écouter : {label}", { label })} icon={<Play className="size-4" aria-hidden="true" />} onClick={() => playSound(value, volume)}>{t("Écouter")}</Button>
      </div>
    </div>
  );
}

function ThemePreview({ dark, half = false }: { dark: boolean; half?: boolean }) {
  const bg = dark ? "#0d0f15" : "#f6f6f7";
  const surface = dark ? "#151821" : "#ffffff";
  const line = dark ? "#2a2f3c" : "#e4e4e7";
  const accent = dark ? "#a5b4fc" : "#4f46e5";
  return (
    <span className={cn("flex h-full gap-1.5 p-2", half ? "w-1/2" : "w-full")} style={{ background: bg }}>
      <span className="w-1/4 rounded" style={{ background: surface, border: `1px solid ${line}` }} />
      <span className="flex flex-1 flex-col gap-1.5 rounded p-1.5" style={{ background: surface, border: `1px solid ${line}` }}>
        <span className="h-1.5 w-2/3 rounded-full" style={{ background: line }} />
        <span className="h-1.5 w-1/2 rounded-full" style={{ background: line }} />
        <span className="mt-auto h-2.5 w-1/3 rounded" style={{ background: accent }} />
      </span>
    </span>
  );
}
