"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ExternalLink, ImagePlus, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { FONTS } from "@/lib/booking-theme";
import { SHOP_PRESETS, encodeShopTheme, type ShopTheme } from "@/lib/shop-theme";
import { saveShopTheme, uploadShopBanner } from "@/server/actions/shop";
import { useT } from "@/components/app-locale";

/** Apparence de la boutique : thèmes prêts, couleurs, police, coins, bannière, mise en page — aperçu en direct. */
export function ShopDesign({ initial, shopUrl }: { initial: ShopTheme; shopUrl: string }) {
  const t = useT();
  const [th, setTh] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(th) !== saved;
  const set = (patch: Partial<ShopTheme>) => { setMsg(null); setTh((x) => ({ ...x, ...patch })); };
  // Aperçu : l'iframe se recharge ~0,5 s après le dernier changement, avec le thème en paramètre (rien n'est enregistré).
  const [src, setSrc] = useState(`${shopUrl}?theme=${encodeShopTheme(initial)}`);
  useEffect(() => { const id = setTimeout(() => setSrc(`${shopUrl}?theme=${encodeShopTheme(th)}`), 500); return () => clearTimeout(id); }, [th, shopUrl]);

  const color = (k: "accentColor" | "pageBg" | "calBg" | "textColor", label: string) => (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <input type="color" value={th[k]} onChange={(e) => set({ [k]: e.target.value })} className="size-9 cursor-pointer rounded-md border border-border bg-surface p-0.5" aria-label={label} />
        <span className="w-16 font-mono text-xs text-muted uppercase">{th[k]}</span>
      </span>
    </label>
  );

  const upload = async (f: File) => {
    setUploading(true);
    const fd = new FormData(); fd.set("file", f);
    const r = await uploadShopBanner(fd).catch(() => ({ ok: false as const, error: t("Envoi impossible.") }));
    setUploading(false);
    if (r.ok) set({ bannerUrl: r.url }); else setMsg({ ok: false, text: r.error });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card>
          <CardHeader title={t("Thèmes prêts")} description={t("Un point de départ : tout reste modifiable ensuite.")} />
          <div className="grid grid-cols-2 gap-2 p-5">
            {SHOP_PRESETS.map((p) => (
              <button key={p.key} type="button" onClick={() => set(p.theme)} className="flex items-center gap-2 rounded-lg border border-border p-2 text-left text-sm hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-accent">
                <span className="flex shrink-0 overflow-hidden rounded-md border border-border" aria-hidden="true">
                  <span className="size-5" style={{ background: p.theme.pageBg }} /><span className="size-5" style={{ background: p.theme.accentColor }} />
                </span>
                {t(p.name)}
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title={t("Couleurs et style")} />
          <div className="space-y-3 p-5">
            {color("accentColor", t("Couleur principale (boutons)"))}
            {color("pageBg", t("Fond de la page"))}
            {color("calBg", t("Fond des cartes"))}
            {color("textColor", t("Texte"))}
            <p className="text-xs text-muted">{t("Les textes restent toujours lisibles : la couleur est ajustée automatiquement si le contraste est trop faible.")}</p>
            <Field label={t("Police")} htmlFor="sd-font"><Select id="sd-font" value={th.font} onChange={(e) => set({ font: e.target.value as ShopTheme["font"] })}>{FONTS.map((f) => <option key={f} value={f}>{f}</option>)}</Select></Field>
            <Field label={t("Coins")} htmlFor="sd-radius"><Select id="sd-radius" value={th.radius} onChange={(e) => set({ radius: e.target.value as ShopTheme["radius"] })}><option value="none">{t("Carrés")}</option><option value="sm">{t("Légèrement arrondis")}</option><option value="md">{t("Arrondis")}</option><option value="lg">{t("Très arrondis")}</option></Select></Field>
            <Field label={t("Ombre des cartes")} htmlFor="sd-shadow"><Select id="sd-shadow" value={th.shadowStyle} onChange={(e) => set({ shadowStyle: e.target.value as ShopTheme["shadowStyle"] })}><option value="none">{t("Aucune")}</option><option value="subtle">{t("Légère")}</option><option value="medium">{t("Moyenne")}</option><option value="strong">{t("Forte")}</option></Select></Field>
          </div>
        </Card>
        <Card>
          <CardHeader title={t("Haut de page et produits")} />
          <div className="space-y-4 p-5">
            <Field label={t("Titre affiché (facultatif)")} htmlFor="sd-title" hint={t("Par défaut : le nom de votre entreprise")}><Input id="sd-title" value={th.title} onChange={(e) => set({ title: e.target.value })} maxLength={80} /></Field>
            <div>
              <p className="text-sm font-medium">{t("Bannière (facultatif)")}</p>
              {th.bannerUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={th.bannerUrl} alt="" className="mt-2 h-24 w-full rounded-lg object-cover" />
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
                <Button type="button" variant="secondary" size="sm" loading={uploading} icon={<ImagePlus className="size-4" aria-hidden="true" />} onClick={() => fileRef.current?.click()}>{th.bannerUrl ? t("Changer l'image") : t("Ajouter une image")}</Button>
                {th.bannerUrl ? <button type="button" onClick={() => set({ bannerUrl: "" })} className="text-sm font-medium text-danger">{t("Retirer")}</button> : null}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">{t("Affichage des produits")}</p>
              <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("Affichage des produits")}>
                {([["grid", t("Grille"), LayoutGrid], ["list", t("Liste"), List]] as const).map(([k, label, Icon]) => (
                  <button key={k} type="button" role="radio" aria-checked={th.layout === k} onClick={() => set({ layout: k })} className={cn("flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium", th.layout === k ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border hover:bg-surface-muted")}><Icon className="size-4" aria-hidden="true" />{label}</button>
                ))}
              </div>
            </div>
          </div>
        </Card>
        {msg ? <p className={cn("rounded-lg px-3 py-2 text-sm", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")} role={msg.ok ? "status" : "alert"}>{t(msg.text)}</p> : null}
        <div className="sticky bottom-0 z-10 -mx-1 flex gap-2 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
          <Button type="button" loading={pending} disabled={!dirty} onClick={() => start(async () => { const r = await saveShopTheme(th).catch(() => ({ ok: false as const, error: t("Enregistrement impossible.") })); if (r.ok) setSaved(JSON.stringify(th)); setMsg({ ok: r.ok, text: r.ok ? (r.message ?? t("Enregistré.")) : r.error }); })}>{t("Enregistrer")}</Button>
          {dirty ? <Button type="button" variant="secondary" onClick={() => setTh(JSON.parse(saved))}>{t("Annuler")}</Button> : null}
        </div>
      </div>
      <Card className="overflow-hidden lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-center justify-between border-b border-border px-4 py-2 text-sm text-muted">
          <span>{t("Aperçu")}{dirty ? ` · ${t("en direct, pas encore enregistré")}` : ""}</span>
          <a href={shopUrl} target="_blank" rel="noopener" className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-surface-muted" aria-label={t("Ouvrir ma boutique")}><ExternalLink className="size-4" aria-hidden="true" /></a>
        </div>
        <iframe src={src} title={t("Aperçu de la boutique")} className="h-[70dvh] min-h-[480px] w-full bg-white lg:h-[calc(100dvh-110px)]" />
      </Card>
    </div>
  );
}
