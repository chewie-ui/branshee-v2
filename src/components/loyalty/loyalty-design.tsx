"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Gift, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { FONTS } from "@/lib/booking-theme";
import { LOYALTY_PRESETS, STAMP_ICONS, loyaltyColors, loyaltyFontHref, type LoyaltyTheme, type StampIcon } from "@/lib/loyalty-theme";
import { LoyaltyCardView, STAMP_ICON } from "@/components/loyalty/loyalty-card-view";
import { saveLoyaltyTheme, uploadLoyaltyImage } from "@/server/actions/loyalty";
import { useT } from "@/components/app-locale";

const ICON_LABEL: Record<StampIcon, string> = { star: "Étoile", heart: "Cœur", coffee: "Café", sandwich: "Sandwich", pizza: "Pizza", scissors: "Ciseaux", sparkles: "Éclat", dumbbell: "Haltère", paw: "Patte", check: "Coche" };

/** Apparence de la carte de fidélité : thèmes, couleurs, police, icône des tampons, logo, nom — aperçu en direct. */
export function LoyaltyDesign({ initial, business, businessLogo, goal, reward, sampleUrl }: { initial: LoyaltyTheme; business: string; businessLogo: string | null; goal: number; reward: string; sampleUrl: string | null }) {
  const t = useT();
  const [th, setTh] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [up, setUp] = useState<"logoUrl" | "bgImage" | null>(null);
  const dirty = JSON.stringify(th) !== saved;
  const set = (patch: Partial<LoyaltyTheme>) => { setMsg(null); setTh((x) => ({ ...x, ...patch })); };
  const colors = loyaltyColors(th);
  const font = loyaltyFontHref(th);
  const sample = Math.max(1, Math.round(goal * 0.6));

  const upload = async (k: "logoUrl" | "bgImage", f: File) => {
    setUp(k);
    const fd = new FormData(); fd.set("file", f);
    const r = await uploadLoyaltyImage(fd).catch(() => ({ ok: false as const, error: t("Envoi impossible.") }));
    setUp(null);
    if (r.ok) set({ [k]: r.url }); else setMsg({ ok: false, text: r.error });
  };
  const color = (k: "cardColor" | "cardText" | "pageBg", label: string) => (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <input type="color" value={th[k]} onChange={(e) => set({ [k]: e.target.value })} className="size-9 cursor-pointer rounded-md border border-border bg-surface p-0.5" aria-label={label} />
        <span className="w-16 font-mono text-xs text-muted uppercase">{th[k]}</span>
      </span>
    </label>
  );
  const imagePicker = (k: "logoUrl" | "bgImage", label: string, hint: string) => (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted">{hint}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {th[k] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={th[k]} alt="" className="size-12 rounded-lg border border-border object-cover" />
        ) : null}
        <label className={cn("inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-sm font-medium hover:bg-surface-muted focus-within:outline-2 focus-within:outline-accent", up === k && "pointer-events-none opacity-60")}>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(k, f); e.target.value = ""; }} />
          <ImagePlus className="size-4" aria-hidden="true" />{up === k ? t("Envoi…") : th[k] ? t("Changer") : t("Ajouter une image")}
        </label>
        {th[k] ? <button type="button" onClick={() => set({ [k]: "" })} className="text-sm font-medium text-danger">{t("Retirer")}</button> : null}
      </div>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      {font ? <link rel="stylesheet" href={font} /> : null}
      <div className="space-y-4">
        <Card>
          <CardHeader title={t("Thèmes prêts")} description={t("Un point de départ : tout reste modifiable ensuite.")} />
          <div className="grid grid-cols-2 gap-2 p-5">
            {LOYALTY_PRESETS.map((p) => {
              const Icon = STAMP_ICON[p.theme.icon ?? "star"];
              return (
                <button key={p.key} type="button" onClick={() => set(p.theme)} className="flex items-center gap-2 rounded-lg border border-border p-2 text-left text-sm hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-accent">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md" style={{ background: p.theme.cardColor, color: p.theme.cardText }} aria-hidden="true"><Icon className="size-4" /></span>
                  {t(p.name)}
                </button>
              );
            })}
          </div>
        </Card>
        <Card>
          <CardHeader title={t("Logo et nom")} />
          <div className="space-y-4 p-5">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={th.showLogo} onChange={(e) => set({ showLogo: e.target.checked })} className="size-4" />{t("Afficher le logo")}</label>
            {th.showLogo ? imagePicker("logoUrl", t("Logo de la carte"), businessLogo ? t("Par défaut : le logo de votre entreprise (Réglages › Établissement).") : t("Ajoutez un logo ici, ou dans Réglages › Établissement.")) : null}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={th.showName} onChange={(e) => set({ showName: e.target.checked })} className="size-4" />{t("Afficher le nom de l'entreprise")}</label>
            {th.showName ? <Field label={t("Nom affiché")} htmlFor="ld-name" hint={t("Vide = « {name} »", { name: business })}><Input id="ld-name" value={th.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} placeholder={business} /></Field> : null}
            <Field label={t("Titre de la carte")} htmlFor="ld-title" hint={t("Vide = « Carte de fidélité »")}><Input id="ld-title" value={th.title} onChange={(e) => set({ title: e.target.value })} maxLength={40} placeholder={t("Carte de fidélité")} /></Field>
          </div>
        </Card>
        <Card>
          <CardHeader title={t("Couleurs et style")} />
          <div className="space-y-3 p-5">
            {color("cardColor", t("Couleur de la carte"))}
            {color("cardText", t("Texte de la carte"))}
            {color("pageBg", t("Fond de la page"))}
            <p className="text-xs text-muted">{t("Les textes restent toujours lisibles : la couleur est ajustée automatiquement si le contraste est trop faible.")}</p>
            <Field label={t("Police")} htmlFor="ld-font"><Select id="ld-font" value={th.font} onChange={(e) => set({ font: e.target.value as LoyaltyTheme["font"] })}>{FONTS.map((f) => <option key={f} value={f}>{f}</option>)}</Select></Field>
            <Field label={t("Coins")} htmlFor="ld-radius"><Select id="ld-radius" value={th.radius} onChange={(e) => set({ radius: e.target.value as LoyaltyTheme["radius"] })}><option value="md">{t("Légèrement arrondis")}</option><option value="lg">{t("Arrondis")}</option><option value="xl">{t("Très arrondis")}</option></Select></Field>
            <div>
              <p className="text-sm font-medium">{t("Icône des tampons")}</p>
              <div className="mt-2 grid grid-cols-5 gap-2" role="radiogroup" aria-label={t("Icône des tampons")}>
                {STAMP_ICONS.map((k) => {
                  const Icon = STAMP_ICON[k];
                  return <button key={k} type="button" role="radio" aria-checked={th.icon === k} aria-label={t(ICON_LABEL[k])} title={t(ICON_LABEL[k])} onClick={() => set({ icon: k })} className={cn("flex h-11 items-center justify-center rounded-lg border", th.icon === k ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border hover:bg-surface-muted")}><Icon className="size-5" aria-hidden="true" /></button>;
                })}
              </div>
            </div>
            {imagePicker("bgImage", t("Image de fond (facultatif)"), t("Une photo de votre boutique ou de vos produits, voilée de la couleur de la carte."))}
          </div>
        </Card>
        {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{t(msg.text)}</p> : null}
        <div className="sticky bottom-0 z-10 -mx-1 flex gap-2 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
          <Button type="button" loading={pending} disabled={!dirty} onClick={() => start(async () => { const r = await saveLoyaltyTheme(th).catch(() => ({ ok: false as const, error: t("Enregistrement impossible.") })); if (r.ok) setSaved(JSON.stringify(th)); setMsg({ ok: r.ok, text: r.ok ? (r.message ?? t("Enregistré.")) : r.error }); })}>{t("Enregistrer")}</Button>
          {dirty ? <Button type="button" variant="secondary" onClick={() => setTh(JSON.parse(saved))}>{t("Annuler")}</Button> : null}
        </div>
      </div>
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-center justify-between pb-2 text-sm text-muted">
          <span>{t("Aperçu")}{dirty ? ` · ${t("en direct, pas encore enregistré")}` : ""}</span>
          {sampleUrl ? <a href={sampleUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-hover">{t("Voir une vraie carte")}<ExternalLink className="size-4" aria-hidden="true" /></a> : null}
        </div>
        <div className="flex justify-center rounded-2xl border border-border p-6 sm:p-10" style={{ background: colors.page }}>
          <div className="w-full max-w-sm">
            <LoyaltyCardView
              theme={th}
              business={business}
              businessLogo={businessLogo}
              holder="Marie"
              stamps={sample}
              goal={goal}
              title={t("Carte de fidélité")}
              stampsLabel={`${sample} / ${goal}`}
              footer={<><Gift className="mr-1.5 inline size-4" aria-hidden="true" />{t("Encore {n} tampons pour : {reward}", { n: goal - sample, reward })}</>}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
