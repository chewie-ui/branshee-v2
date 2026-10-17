"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Monitor, Redo2, RotateCcw, Smartphone, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { DEFAULT_THEME, FONTS, PRESETS, fontStylesheet, themeVars, type FullTheme } from "@/lib/booking-theme";
import { cn } from "@/lib/cn";
import { saveTheme, uploadPageBackground } from "@/server/actions/booking-page";

type ColorKey = "accentColor" | "accentText" | "pageBg" | "calBg" | "textColor" | "dayBg" | "daySelectedBg" | "daySelectedText" | "dayHoverBg" | "btnHoverBg" | "dayAvailableColor" | "dayBusyColor" | "dayFullColor";

const GROUPS: { title: string; rows: { k: ColorKey; label: string; auto?: string }[] }[] = [
  { title: "Couleurs principales", rows: [{ k: "accentColor", label: "Couleur d'accent (boutons, sélection)" }, { k: "accentText", label: "Texte sur la couleur d'accent" }] },
  { title: "Fond et texte", rows: [{ k: "pageBg", label: "Fond de la page" }, { k: "calBg", label: "Fond du calendrier et des cartes" }, { k: "textColor", label: "Couleur du texte" }] },
  {
    title: "Jours et boutons",
    rows: [
      { k: "dayBg", label: "Fond des jours" },
      { k: "daySelectedBg", label: "Jour sélectionné", auto: "Suit la couleur d'accent" },
      { k: "daySelectedText", label: "Texte du jour sélectionné", auto: "Suit la couleur d'accent" },
      { k: "dayHoverBg", label: "Jour au survol", auto: "Automatique" },
      { k: "btnHoverBg", label: "Bouton au survol", auto: "Automatique (plus foncé)" },
    ],
  },
  { title: "Disponibilité des jours", rows: [{ k: "dayAvailableColor", label: "Places libres" }, { k: "dayBusyColor", label: "Presque complet" }, { k: "dayFullColor", label: "Complet" }] },
];

const CHOICES = {
  radius: [{ v: "none", l: "Carré" }, { v: "sm", l: "Léger" }, { v: "md", l: "Normal" }, { v: "lg", l: "Arrondi" }],
  borderStyle: [{ v: "none", l: "Aucune" }, { v: "subtle", l: "Discrète" }, { v: "medium", l: "Moyenne" }, { v: "strong", l: "Marquée" }],
  shadowStyle: [{ v: "none", l: "Aucune" }, { v: "subtle", l: "Discrète" }, { v: "medium", l: "Moyenne" }, { v: "strong", l: "Marquée" }],
  layout: [{ v: "classic", l: "Calendrier à gauche" }, { v: "split", l: "Calendrier à droite" }],
} as const;

function ColorRow({ label, value, auto, fallback, onChange }: { label: string; value: string | undefined; auto?: string; fallback: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value ?? "");
  const [prev, setPrev] = useState(value);
  // Valeur externe changée (thème, annuler…) : on resynchronise le champ texte.
  if (prev !== value) {
    setPrev(value);
    setText(value ?? "");
  }
  const id = `c-${label.replace(/\W+/g, "-")}`;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <input type="color" value={value || fallback} onChange={(e) => onChange(e.target.value)} className="size-9 shrink-0 cursor-pointer rounded-md border border-border-strong bg-surface p-0.5" aria-label={label} />
      <label htmlFor={id} className="min-w-0 flex-1 text-sm">
        {label}
        {auto && !value ? <span className="block text-xs text-muted">{auto}</span> : null}
      </label>
      <Input
        id={id}
        value={text}
        placeholder={auto ? "Auto" : ""}
        onChange={(e) => {
          setText(e.target.value);
          if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value.toLowerCase());
          else if (auto && e.target.value === "") onChange("");
        }}
        className="w-24 font-mono text-xs uppercase"
        maxLength={7}
        spellCheck={false}
      />
      {auto && value ? (
        <button type="button" onClick={() => onChange("")} className="text-xs font-medium text-accent hover:text-accent-hover">Auto</button>
      ) : null}
    </div>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-muted p-1 sm:grid-cols-4" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)} className={cn("h-8 rounded-md text-sm font-medium", value === o.v ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text")}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ThemeEditor({ initial, previewUrl }: { initial: FullTheme; previewUrl: string }) {
  const [saved, setSaved] = useState(initial);
  const [hist, setHist] = useState<{ list: FullTheme[]; i: number }>({ list: [initial], i: 0 });
  const t = hist.list[hist.i]!;
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [pending, start] = useTransition();
  const [uploading, startUpload] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const dirty = JSON.stringify(t) !== JSON.stringify(saved);

  const commit = useCallback((next: FullTheme) => {
    setStatus(null);
    setHist((h) => ({ list: [...h.list.slice(0, h.i + 1), next].slice(-60), i: Math.min(h.i + 1, 59) }));
  }, []);
  const patch = (p: Partial<FullTheme>) => commit({ ...t, ...p });
  const undo = useCallback(() => setHist((h) => ({ ...h, i: Math.max(0, h.i - 1) })), []);
  const redo = useCallback(() => setHist((h) => ({ ...h, i: Math.min(h.list.length - 1, h.i + 1) })), []);

  // Aperçu en direct : la page publique (ouverte avec ?apercu=1) applique le thème reçu.
  const send = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: "branshee-theme", vars: themeVars(t), font: fontStylesheet(t), texts: t.texts, bgImage: t.pageBgImage ?? "", layout: t.layout }, location.origin);
  }, [t]);
  useEffect(send, [send]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement)?.isContentEditable || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
      <div className="space-y-4">
        <div className="sticky top-0 z-10 flex items-center gap-2 rounded-xl border border-border bg-surface p-2">
          <button type="button" onClick={undo} disabled={hist.i === 0} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text disabled:opacity-30" aria-label="Annuler (Ctrl+Z)" title="Annuler (Ctrl+Z)"><Undo2 className="size-4" aria-hidden="true" /></button>
          <button type="button" onClick={redo} disabled={hist.i >= hist.list.length - 1} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-text disabled:opacity-30" aria-label="Rétablir (Ctrl+Y)" title="Rétablir (Ctrl+Y)"><Redo2 className="size-4" aria-hidden="true" /></button>
          <button type="button" onClick={() => commit({ ...DEFAULT_THEME })} className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted hover:bg-surface-muted hover:text-text"><RotateCcw className="size-4" aria-hidden="true" />Réinitialiser</button>
          <span className="ml-auto flex items-center gap-2">
            {status ? <span className={cn("text-sm", status.ok ? "text-success" : "text-danger")} role={status.ok ? "status" : "alert"}>{status.msg}</span> : null}
            {dirty ? <Button variant="ghost" size="sm" onClick={() => setHist({ list: [saved], i: 0 })}>Annuler</Button> : null}
            <Button
              size="sm"
              loading={pending}
              disabled={!dirty}
              onClick={() =>
                start(async () => {
                  const res = await saveTheme(t);
                  if (res.ok) { setSaved(t); setStatus({ ok: true, msg: "Enregistré." }); }
                  else setStatus({ ok: false, msg: res.error });
                })
              }
            >
              Enregistrer
            </Button>
          </span>
        </div>

        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold">Thèmes</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {PRESETS.map((p) => (
              <button key={p.key} type="button" onClick={() => commit({ ...t, ...p.theme })} className="overflow-hidden rounded-lg border border-border text-left text-xs font-medium hover:border-accent">
                <span className="flex h-10" style={{ background: p.theme.pageBg }}>
                  <span className="m-2 flex-1 rounded" style={{ background: p.theme.calBg, borderRadius: p.theme.radius === "lg" ? 8 : p.theme.radius === "sm" ? 2 : 4 }}>
                    <span className="m-1.5 block h-2 w-6 rounded-sm" style={{ background: p.theme.accentColor }} />
                  </span>
                </span>
                <span className="block px-2 py-1.5" style={{ fontFamily: p.theme.font }}>{p.name}</span>
              </button>
            ))}
          </div>
        </Card>

        {GROUPS.map((g) => (
          <Card key={g.title} className="p-4">
            <p className="mb-1 text-sm font-semibold">{g.title}</p>
            {g.rows.map((r) => (
              <ColorRow key={r.k} label={r.label} value={t[r.k]} auto={r.auto} fallback={r.k === "daySelectedBg" ? t.accentColor : r.k === "daySelectedText" ? t.accentText : r.k === "btnHoverBg" || r.k === "dayHoverBg" ? t.accentColor : "#ffffff"} onChange={(v) => patch({ [r.k]: v || undefined } as Partial<FullTheme>)} />
            ))}
            {g.title === "Disponibilité des jours" ? (
              <div className="mt-2 flex gap-2" aria-hidden="true">
                {[{ c: t.dayAvailableColor, l: "12" }, { c: t.dayBusyColor, l: "13" }, { c: t.dayFullColor, l: "14" }].map((d) => (
                  <span key={d.l} className="flex w-12 flex-col items-center rounded-md border border-border py-1.5 text-sm font-semibold" style={{ background: t.dayBg, color: t.textColor }}>
                    {d.l}
                    <span className="mt-1 size-1.5 rounded-full" style={{ background: d.c }} />
                  </span>
                ))}
              </div>
            ) : null}
          </Card>
        ))}

        <Card className="space-y-4 p-4">
          <p className="text-sm font-semibold">Image de fond</p>
          <div className="flex flex-wrap items-center gap-3">
            {t.pageBgImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.pageBgImage} alt="" className="h-12 w-20 rounded-md border border-border object-cover" />
            ) : <span className="text-sm text-muted">Aucune — couleur de fond uniquement.</span>}
            <label className="cursor-pointer text-sm font-medium text-accent hover:text-accent-hover">
              {uploading ? "Envoi…" : t.pageBgImage ? "Changer" : "Ajouter une image"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const fd = new FormData();
                  fd.set("image", f);
                  startUpload(async () => {
                    const res = await uploadPageBackground(fd);
                    if (res.ok) patch({ pageBgImage: res.url });
                    else setStatus({ ok: false, msg: res.error });
                  });
                }}
              />
            </label>
            {t.pageBgImage ? <button type="button" onClick={() => patch({ pageBgImage: undefined })} className="text-sm text-muted hover:text-danger">Retirer</button> : null}
          </div>
        </Card>

        <Card className="space-y-4 p-4">
          <p className="text-sm font-semibold">Textes</p>
          <Field label="Aide au-dessus du calendrier" htmlFor="tx-help" hint="Ex. « Pour une urgence, appelez-nous directement. »">
            <Input id="tx-help" value={t.texts.calendarHelp} onChange={(e) => patch({ texts: { ...t.texts, calendarHelp: e.target.value } })} maxLength={200} />
          </Field>
          <Field label="Titre de l'étape créneau" htmlFor="tx-slot">
            <Input id="tx-slot" value={t.texts.slotHeading} onChange={(e) => patch({ texts: { ...t.texts, slotHeading: e.target.value } })} placeholder="Choisissez un créneau" maxLength={80} />
          </Field>
          <Field label="Fuseau horaire affiché" htmlFor="tx-tz" hint="Laissez vide pour ne rien afficher.">
            <Input id="tx-tz" value={t.texts.timezone} onChange={(e) => patch({ texts: { ...t.texts, timezone: e.target.value } })} placeholder="Heure de Bruxelles" maxLength={60} />
          </Field>
        </Card>

        <Card className="space-y-4 p-4">
          <p className="text-sm font-semibold">Police de caractères</p>
          <div className="grid grid-cols-2 gap-2">
            {FONTS.map((f) => (
              <button key={f} type="button" aria-pressed={t.font === f && !t.customFontUrl} onClick={() => patch({ font: f, customFontUrl: undefined, customFontFamily: undefined })} className={cn("h-10 rounded-lg border text-sm", t.font === f && !t.customFontUrl ? "border-accent bg-accent-soft" : "border-border hover:border-accent")}>
                {f}
              </button>
            ))}
          </div>
          <details className="text-sm" open={!!t.customFontUrl}>
            <summary className="cursor-pointer font-medium text-accent">Ou importez votre propre police</summary>
            <div className="mt-3 space-y-3">
              <Field label="Adresse de la police (Google Fonts ou feuille @font-face)" htmlFor="cf-url">
                <Input id="cf-url" value={t.customFontUrl ?? ""} onChange={(e) => patch({ customFontUrl: e.target.value || undefined })} placeholder="https://fonts.googleapis.com/css2?family=…" />
              </Field>
              <Field label="Nom de la police (font-family)" htmlFor="cf-family">
                <Input id="cf-family" value={t.customFontFamily ?? ""} onChange={(e) => patch({ customFontFamily: e.target.value || undefined })} placeholder="Roboto Slab" />
              </Field>
            </div>
          </details>
        </Card>

        <Card className="space-y-4 p-4">
          <Segmented label="Arrondi des coins" value={t.radius} options={CHOICES.radius} onChange={(v) => patch({ radius: v })} />
          <Segmented label="Bordures" value={t.borderStyle} options={CHOICES.borderStyle} onChange={(v) => patch({ borderStyle: v })} />
          <Segmented label="Ombres" value={t.shadowStyle} options={CHOICES.shadowStyle} onChange={(v) => patch({ shadowStyle: v })} />
          <div>
            <p className="mb-2 text-sm font-medium">Disposition</p>
            <Select value={t.layout} onChange={(e) => patch({ layout: e.target.value as FullTheme["layout"] })} aria-label="Disposition">
              {CHOICES.layout.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </Select>
          </div>
        </Card>
      </div>

      <div className="xl:sticky xl:top-4 xl:self-start">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Aperçu en direct {dirty ? <span className="text-muted">— non enregistré</span> : null}</p>
          <div className="flex gap-1 rounded-lg bg-surface-muted p-1">
            <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} className={cn("flex size-8 items-center justify-center rounded-md", device === "desktop" ? "bg-surface shadow-sm" : "text-muted")} aria-label="Aperçu ordinateur"><Monitor className="size-4" aria-hidden="true" /></button>
            <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} className={cn("flex size-8 items-center justify-center rounded-md", device === "mobile" ? "bg-surface shadow-sm" : "text-muted")} aria-label="Aperçu mobile"><Smartphone className="size-4" aria-hidden="true" /></button>
          </div>
        </div>
        <div className={cn("mx-auto overflow-hidden rounded-xl border border-border bg-surface", device === "mobile" ? "w-[390px] max-w-full" : "w-full")}>
          <iframe ref={frame} src={previewUrl} onLoad={send} title="Aperçu de votre page de réservation" className="h-[78vh] w-full" />
        </div>
      </div>
    </div>
  );
}
