"use client";

import { useEffect, useState, useTransition } from "react";
import { Calendar, Check, Copy, Download, Link2, MessageCircle, MousePointerClick } from "lucide-react";
import QRCode from "qrcode";
import { CopyLink } from "@/components/app/copy-link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { PLATFORMS, embedCode, type EmbedFormat } from "@/lib/embed-platforms";
import { saveEmbed, saveSlug } from "@/server/actions/booking-page";

export function SlugCard({ origin, slug }: { origin: string; slug: string }) {
  const [saved, setSaved] = useState(slug);
  const [value, setValue] = useState(slug);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const url = `${origin}/${saved}`;
  return (
    <Card>
      <CardHeader title="Votre lien de réservation" description="À mettre sur Google, Instagram, WhatsApp, vos cartes de visite…" />
      <div className="space-y-5 p-5">
        <CopyLink url={url} trackShare />
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await saveSlug(value);
              if (res.ok) { setSaved(res.slug!); setValue(res.slug!); setStatus({ ok: true, msg: "Adresse modifiée." }); }
              else setStatus({ ok: false, msg: res.error });
            });
          }}
        >
          <label htmlFor="slug" className="text-sm font-medium">Adresse personnalisée</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-stretch overflow-hidden rounded-lg border border-border-strong focus-within:border-accent">
              <span className="flex items-center bg-surface-muted px-3 text-sm text-muted">{origin.replace(/^https?:\/\//, "")}/</span>
              <input id="slug" value={value} onChange={(e) => { setValue(e.target.value); setStatus(null); }} maxLength={60} className="h-10 min-w-0 flex-1 bg-surface px-3 text-sm focus-visible:outline-none" />
            </div>
            <Button type="submit" variant="secondary" loading={pending} disabled={value === saved}>Enregistrer</Button>
          </div>
          {status ? <p className={cn("text-sm", status.ok ? "text-success" : "text-danger")} role={status.ok ? "status" : "alert"}>{status.msg}</p> : <p className="text-xs text-muted">Attention : l&apos;ancien lien cessera de fonctionner (pensez à le changer partout où vous l&apos;avez partagé).</p>}
        </form>
      </div>
    </Card>
  );
}

export function QrCard({ url, name }: { url: string; name: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 600, margin: 2, errorCorrectionLevel: "M" }).then((d) => alive && setSrc(d)).catch(() => {});
    return () => { alive = false; };
  }, [url]);
  return (
    <Card>
      <CardHeader title="QR code" description="À imprimer pour votre salle d'attente, vitrine ou flyers : il ouvre directement votre page." />
      <div className="flex flex-col items-center gap-4 p-5 sm:flex-row">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`QR code vers la page de réservation de ${name}`} className="size-40 rounded-lg border border-border bg-white" />
        ) : <span className="size-40 animate-pulse rounded-lg bg-surface-muted" />}
        <div className="space-y-2 text-sm text-muted">
          <p>Scannez-le avec votre téléphone pour vérifier.</p>
          {src ? (
            <a href={src} download={`qr-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 font-medium text-text hover:bg-surface-muted">
              <Download className="size-4" aria-hidden="true" />
              Télécharger (PNG)
            </a>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

const FORMATS: { k: EmbedFormat; t: string; d: string; icon: typeof Calendar }[] = [
  { k: "inline", t: "Calendrier dans la page", d: "Le calendrier s'affiche directement à l'endroit choisi.", icon: Calendar },
  { k: "popup", t: "Bouton « Prendre rendez-vous »", d: "Un bouton qui ouvre le calendrier par-dessus la page.", icon: MousePointerClick },
  { k: "bubble", t: "Bulle flottante", d: "Un bouton fixé dans un coin, sur toutes les pages du site.", icon: MessageCircle },
  { k: "link", t: "Lien simple", d: "Un bouton qui ouvre votre page de réservation. Fonctionne partout.", icon: Link2 },
];
const SECTIONS = [
  { k: "profile", l: "Profil" },
  { k: "reviews", l: "Avis" },
  { k: "about", l: "À propos" },
  { k: "hours", l: "Horaires" },
];

export function EmbedBuilder({ origin, slug, accent, initial }: { origin: string; slug: string; accent: string; initial: { title: string; fontUrl: string; fontFamily: string } }) {
  const [format, setFormat] = useState<EmbedFormat>("inline");
  const [plat, setPlat] = useState("wordpress");
  const platform = PLATFORMS.find((p) => p.key === plat) ?? PLATFORMS[PLATFORMS.length - 1]!;
  const [noScript, setNoScript] = useState(!platform.script);
  const [sections, setSections] = useState<string[]>(["booking", "profile", "reviews", "about", "hours"]);
  const [label, setLabel] = useState("Prendre rendez-vous");
  const [color, setColor] = useState(accent);
  const [side, setSide] = useState<"left" | "right">("right");
  const [width, setWidth] = useState("100%");
  const [height, setHeight] = useState(800);
  const [look, setLook] = useState(initial);
  const [savedLook, setSavedLook] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const overlay = format === "popup" || format === "bubble";
  const autoHeight = platform.script && !noScript;
  const code = embedCode({ origin, pageUrl: `${origin}/${slug}`, format, sections, autoHeight, width, height, label, color, side });
  const note = overlay ? platform.noteScript : platform.note;
  const blocked = overlay && platform.overlay === false;

  return (
    <Card>
      <CardHeader title="Intégrer à votre site web" description="Trois étapes : la forme, votre outil, puis le code à copier." />
      <div className="space-y-8 p-5">
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 font-semibold"><span className="flex size-6 items-center justify-center rounded-full bg-accent text-xs text-accent-foreground">1</span>Sous quelle forme ?</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FORMATS.map((f) => (
              <button key={f.k} type="button" aria-pressed={format === f.k} onClick={() => setFormat(f.k)} className={cn("flex gap-3 rounded-lg border p-3 text-left", format === f.k ? "border-accent bg-accent-soft" : "border-border-strong hover:border-accent")}>
                <f.icon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-medium">{f.t}</span>
                  <span className="block text-sm text-muted">{f.d}</span>
                </span>
              </button>
            ))}
          </div>
          {format !== "inline" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Texte du bouton" htmlFor="emb-label">
                <Input id="emb-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} />
              </Field>
              <Field label="Couleur du bouton" htmlFor="emb-color">
                <input id="emb-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full cursor-pointer rounded-lg border border-border-strong bg-surface p-1" />
              </Field>
              {format === "bubble" ? (
                <Field label="Côté de la bulle" htmlFor="emb-side">
                  <Select id="emb-side" value={side} onChange={(e) => setSide(e.target.value as "left" | "right")}>
                    <option value="right">À droite</option>
                    <option value="left">À gauche</option>
                  </Select>
                </Field>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <h3 className="flex items-center gap-2 font-semibold"><span className="flex size-6 items-center justify-center rounded-full bg-accent text-xs text-accent-foreground">2</span>Où voulez-vous l&apos;intégrer ?</h3>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button key={p.key} type="button" aria-pressed={plat === p.key} onClick={() => { setPlat(p.key); setNoScript(!p.script); }} className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", plat === p.key ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border text-muted hover:text-text")}>
                {p.name}
              </button>
            ))}
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {platform.steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
          {blocked || note ? <p className={cn("rounded-lg p-3 text-sm", blocked ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning")}>{note}</p> : null}
          {format === "inline" ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={noScript || !platform.script} disabled={!platform.script} onChange={(e) => setNoScript(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              Mon site n&apos;accepte pas le JavaScript (hauteur fixe)
            </label>
          ) : null}
        </section>

        {format !== "link" ? (
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold"><span className="flex size-6 items-center justify-center rounded-full bg-accent text-xs text-accent-foreground">3</span>Qu&apos;affiche-t-on ?</h3>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent-soft-foreground">Calendrier (inclus)</span>
              {SECTIONS.map((s) => {
                const on = sections.includes(s.k);
                return (
                  <button key={s.k} type="button" aria-pressed={on} onClick={() => setSections((l) => (on ? l.filter((x) => x !== s.k) : [...l, s.k]))} className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", on ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border text-muted hover:text-text")}>
                    {s.l}
                  </button>
                );
              })}
            </div>
            <details className="rounded-lg border border-border p-3 text-sm">
              <summary className="cursor-pointer font-medium">Apparence et dimensions</summary>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Titre affiché au-dessus du calendrier" htmlFor="emb-title" className="sm:col-span-2">
                  <Input id="emb-title" value={look.title} onChange={(e) => { setLook({ ...look, title: e.target.value }); setStatus(null); }} maxLength={80} placeholder="Prenez rendez-vous en ligne" />
                </Field>
                <Field label="Police personnalisée (adresse)" htmlFor="emb-font-url">
                  <Input id="emb-font-url" value={look.fontUrl} onChange={(e) => { setLook({ ...look, fontUrl: e.target.value }); setStatus(null); }} placeholder="https://fonts.googleapis.com/css2?family=…" />
                </Field>
                <Field label="Nom de la police" htmlFor="emb-font-family">
                  <Input id="emb-font-family" value={look.fontFamily} onChange={(e) => { setLook({ ...look, fontFamily: e.target.value }); setStatus(null); }} placeholder="Ex. celle de votre site" />
                </Field>
                {format === "inline" ? (
                  <>
                    <Field label="Largeur" htmlFor="emb-w" hint="100% ou un nombre de pixels.">
                      <Input id="emb-w" value={width} onChange={(e) => setWidth(e.target.value)} maxLength={8} />
                    </Field>
                    {!autoHeight ? (
                      <Field label="Hauteur (px)" htmlFor="emb-h">
                        <Input id="emb-h" type="number" min={400} max={3000} value={height} onChange={(e) => setHeight(Number(e.target.value) || 800)} />
                      </Field>
                    ) : null}
                  </>
                ) : null}
                <div className="flex items-center gap-3 sm:col-span-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={pending}
                    disabled={JSON.stringify(look) === JSON.stringify(savedLook)}
                    onClick={() =>
                      start(async () => {
                        const res = await saveEmbed(look);
                        if (res.ok) { setSavedLook(look); setStatus({ ok: true, msg: "Titre et police enregistrés." }); }
                        else setStatus({ ok: false, msg: res.error });
                      })
                    }
                  >
                    Enregistrer le titre et la police
                  </Button>
                  {status ? <span className={cn("text-sm", status.ok ? "text-success" : "text-danger")}>{status.msg}</span> : null}
                </div>
              </div>
            </details>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Copiez ce code</h3>
            <Button
              size="sm"
              disabled={blocked}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* presse-papiers indisponible : le code reste sélectionnable */
                }
              }}
              icon={copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            >
              {copied ? "Copié" : "Copier le code"}
            </Button>
          </div>
          <pre className={cn("max-h-80 overflow-auto rounded-lg bg-surface-muted p-3 text-xs", blocked && "opacity-50")}><code>{code}</code></pre>
        </section>
      </div>
    </Card>
  );
}
