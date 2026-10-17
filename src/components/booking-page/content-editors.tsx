"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bold, Eye, EyeOff, ImagePlus, Italic, List, ListOrdered, Trash2, Underline } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { addGalleryImages, saveGallery, saveLocation, saveProfile, saveSections, saveSocial } from "@/server/actions/booking-page";
import type { PageSection } from "@/db/schema";
import { LANGUAGES } from "@/lib/languages";
import { SaveBar } from "./editors";

type Status = { ok: boolean; msg: string } | null;

function useSaver() {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Status>(null);
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, okMsg: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setStatus({ ok: true, msg: okMsg });
        after?.();
      } else setStatus({ ok: false, msg: res.error });
    });
  return { pending, status, setStatus, run };
}

/* ───────────────────────── Profil : photo + « À propos » ───────────────────────── */

const SIZES = [
  { v: "2", l: "Petit" },
  { v: "3", l: "Normal" },
  { v: "5", l: "Grand" },
];

export function ProfileEditor({ name, photoUrl, aboutHtml }: { name: string; photoUrl: string | null; aboutHtml: string }) {
  const editor = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(photoUrl);
  const [removed, setRemoved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { pending, status, setStatus, run } = useSaver();

  // Mise en forme du texte riche : l'ancien éditeur utilisait les mêmes commandes,
  // le HTML produit est nettoyé côté serveur (seules quelques balises passent).
  const exec = (cmd: string, value?: string) => {
    editor.current?.focus();
    document.execCommand(cmd, false, value);
    setDirty(true);
    setStatus(null);
  };

  return (
    <Card>
      <CardHeader title="Profil" description="La photo (ou le logo) et la présentation affichées en haut de votre page." />
      <div className="space-y-5 p-5">
        <div className="flex items-center gap-4">
          <Avatar name={name} src={preview} size="lg" className="size-16 text-lg" />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={<ImagePlus className="size-4" aria-hidden="true" />} onClick={() => fileRef.current?.click()}>
              {preview ? "Changer" : "Ajouter une photo ou un logo"}
            </Button>
            {preview ? (
              <Button variant="ghost" size="sm" onClick={() => { setPreview(null); setRemoved(true); if (fileRef.current) fileRef.current.value = ""; setDirty(true); }}>
                Retirer
              </Button>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              aria-label="Photo ou logo"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setPreview(URL.createObjectURL(f)); setRemoved(false); setDirty(true); setStatus(null); }
              }}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium" id="about-label">À propos</p>
          <div className="overflow-hidden rounded-lg border border-border-strong focus-within:border-accent">
            <div className="flex flex-wrap items-center gap-1 border-b border-border bg-surface-muted px-2 py-1.5" role="toolbar" aria-label="Mise en forme">
              {[
                { cmd: "bold", icon: Bold, label: "Gras" },
                { cmd: "italic", icon: Italic, label: "Italique" },
                { cmd: "underline", icon: Underline, label: "Souligné" },
                { cmd: "insertUnorderedList", icon: List, label: "Liste à puces" },
                { cmd: "insertOrderedList", icon: ListOrdered, label: "Liste numérotée" },
              ].map((b) => (
                <button key={b.cmd} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec(b.cmd)} className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-text" aria-label={b.label} title={b.label}>
                  <b.icon className="size-4" aria-hidden="true" />
                </button>
              ))}
              <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
              {SIZES.map((s) => (
                <button key={s.v} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("fontSize", s.v)} className="h-8 rounded-md px-2 text-xs font-medium text-muted hover:bg-surface hover:text-text">
                  {s.l}
                </button>
              ))}
            </div>
            <div
              ref={editor}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-labelledby="about-label"
              onInput={() => { setDirty(true); setStatus(null); }}
              className="prose-about min-h-36 px-3 py-2.5 text-sm focus-visible:outline-none"
              dangerouslySetInnerHTML={{ __html: aboutHtml }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted">Votre parcours, votre approche, ce qui vous distingue. 3 000 caractères maximum.</p>
        </div>
      </div>
      <SaveBar
        dirty={dirty}
        pending={pending}
        status={status}
        onReset={() => location.reload()}
        onSave={() => {
          const fd = new FormData();
          fd.set("aboutHtml", editor.current?.innerHTML ?? "");
          const f = fileRef.current?.files?.[0];
          if (f) fd.set("photo", f);
          if (removed) fd.set("removePhoto", "1");
          run(() => saveProfile(fd), "Profil enregistré.", () => { setDirty(false); setRemoved(false); if (fileRef.current) fileRef.current.value = ""; });
        }}
      />
    </Card>
  );
}

/* ───────────────────────── Localisation ───────────────────────── */

const COUNTRIES = ["Belgique", "France", "Luxembourg", "Suisse", "Pays-Bas", "Allemagne", "Canada", "Maroc", "Tunisie", "Espagne", "Italie", "Portugal"];

type Loc = { mode: "on_site" | "online" | "embed"; address: string; postalCode: string; city: string; country: string; mapsUrl: string; mapEmbed: string; languages: string[] };

export function LocationEditor({ initial }: { initial: Loc }) {
  const [saved, setSaved] = useState(initial);
  const [v, setV] = useState(initial);
  const { pending, status, setStatus, run } = useSaver();
  const set = (patch: Partial<Loc>) => { setV((x) => ({ ...x, ...patch })); setStatus(null); };
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const fullAddress = [v.address, [v.postalCode, v.city].filter(Boolean).join(" "), v.country].filter(Boolean).join(", ");

  return (
    <Card>
      <CardHeader title="Localisation" description="Où se passent vos rendez-vous. Utilisé sur votre page et dans les emails aux clients." />
      <div className="space-y-5 p-5">
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Type de lieu">
          {[
            { k: "on_site", t: "Sur place", d: "À votre cabinet / salon" },
            { k: "online", t: "En ligne", d: "Visio, téléphone" },
            { k: "embed", t: "Carte personnalisée", d: "Votre carte Google Maps" },
          ].map((o) => (
            <button key={o.k} type="button" role="radio" aria-checked={v.mode === o.k} onClick={() => set({ mode: o.k as Loc["mode"] })} className={cn("rounded-lg border p-3 text-left text-sm", v.mode === o.k ? "border-accent bg-accent-soft" : "border-border-strong hover:border-accent")}>
              <span className="block font-medium">{o.t}</span>
              <span className="block text-muted">{o.d}</span>
            </button>
          ))}
        </div>

        {v.mode !== "online" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Adresse" htmlFor="loc-address" className="sm:col-span-2">
              <Input id="loc-address" value={v.address} onChange={(e) => set({ address: e.target.value })} autoComplete="street-address" maxLength={120} placeholder="Rue de l'Exemple 1" />
            </Field>
            <Field label="Code postal" htmlFor="loc-zip">
              <Input id="loc-zip" value={v.postalCode} onChange={(e) => set({ postalCode: e.target.value })} autoComplete="postal-code" maxLength={12} />
            </Field>
            <Field label="Ville" htmlFor="loc-city">
              <Input id="loc-city" value={v.city} onChange={(e) => set({ city: e.target.value })} autoComplete="address-level2" maxLength={80} />
            </Field>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pays" htmlFor="loc-country">
            <Input id="loc-country" list="loc-countries" value={v.country} onChange={(e) => set({ country: e.target.value })} maxLength={60} />
            <datalist id="loc-countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          {v.mode === "on_site" ? (
            <Field label="Lien « Ouvrir dans Maps » (facultatif)" htmlFor="loc-maps" hint="Sinon, le lien est créé à partir de l'adresse.">
              <Input id="loc-maps" type="url" value={v.mapsUrl} onChange={(e) => set({ mapsUrl: e.target.value })} placeholder="https://maps.app.goo.gl/…" maxLength={500} />
            </Field>
          ) : null}
        </div>

        {v.mode === "embed" ? (
          <Field label="Code de la carte Google Maps" htmlFor="loc-embed" hint="Sur Google Maps : Partager → Intégrer une carte → Copier le HTML, puis collez-le ici.">
            <Textarea id="loc-embed" value={v.mapEmbed} onChange={(e) => set({ mapEmbed: e.target.value })} rows={3} placeholder='<iframe src="https://www.google.com/maps/embed?pb=…"></iframe>' className="font-mono text-xs" />
          </Field>
        ) : null}

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Langues parlées</legend>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((l) => {
              const on = v.languages.includes(l.code);
              return (
                <button key={l.code} type="button" aria-pressed={on} onClick={() => set({ languages: on ? v.languages.filter((x) => x !== l.code) : [...v.languages, l.code] })} className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", on ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border bg-surface text-muted hover:text-text")}>
                  {l.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        {v.mode === "on_site" && fullAddress ? (
          <iframe title="Aperçu de la carte" src={`https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`} className="h-48 w-full rounded-lg border border-border" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        ) : null}
      </div>
      <SaveBar dirty={dirty} pending={pending} status={status} onReset={() => { setV(saved); setStatus(null); }} onSave={() => run(() => saveLocation(v), "Localisation enregistrée.", () => setSaved(v))} />
    </Card>
  );
}

/* ───────────────────────── Galerie ───────────────────────── */

type Layout = "grid" | "mosaic" | "carousel";

export function GalleryEditor({ images, layout }: { images: string[]; layout: Layout }) {
  const [saved, setSaved] = useState({ images, layout });
  const [list, setList] = useState(images);
  const [lay, setLay] = useState<Layout>(layout);
  const { pending, status, setStatus, run } = useSaver();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const dirty = JSON.stringify(list) !== JSON.stringify(saved.images) || lay !== saved.layout;
  const move = (i: number, d: -1 | 1) => setList((l) => { const c = [...l]; [c[i], c[i + d]] = [c[i + d]!, c[i]!]; return c; });
  const left = 12 - list.length;

  return (
    <Card>
      <CardHeader title="Galerie photos" description={`Votre cabinet, votre matériel, votre équipe… ${list.length} / 12 photos.`} />
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Présentation">
          <span className="mr-1 text-sm font-medium">Présentation</span>
          {(["grid", "mosaic", "carousel"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={lay === k} onClick={() => { setLay(k); setStatus(null); }} className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", lay === k ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border text-muted hover:text-text")}>
              {k === "grid" ? "Grille" : k === "mosaic" ? "Mosaïque" : "Carrousel"}
            </button>
          ))}
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {list.map((src, i) => (
            <li key={src} className="group relative overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Photo ${i + 1}`} className="aspect-square w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/55 p-1">
                <span className="flex">
                  <button type="button" disabled={i === 0} onClick={() => { move(i, -1); setStatus(null); }} className="flex size-7 items-center justify-center rounded text-white disabled:opacity-30" aria-label={`Déplacer la photo ${i + 1} avant`}><ArrowLeft className="size-4" aria-hidden="true" /></button>
                  <button type="button" disabled={i === list.length - 1} onClick={() => { move(i, 1); setStatus(null); }} className="flex size-7 items-center justify-center rounded text-white disabled:opacity-30" aria-label={`Déplacer la photo ${i + 1} après`}><ArrowRight className="size-4" aria-hidden="true" /></button>
                </span>
                <button type="button" onClick={() => { setList((l) => l.filter((x) => x !== src)); setStatus(null); }} className="flex size-7 items-center justify-center rounded text-white hover:text-red-300" aria-label={`Retirer la photo ${i + 1}`}><Trash2 className="size-4" aria-hidden="true" /></button>
              </div>
            </li>
          ))}
          {left > 0 ? (
            <li>
              <button type="button" disabled={uploading || dirty} onClick={() => fileRef.current?.click()} className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border-strong text-sm text-muted hover:border-accent hover:text-accent disabled:opacity-50" title={dirty ? "Enregistrez d'abord vos changements" : undefined}>
                <ImagePlus className="size-5" aria-hidden="true" />
                {uploading ? "Envoi…" : "Ajouter"}
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                aria-label="Ajouter des photos"
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])];
                  if (!files.length) return;
                  const fd = new FormData();
                  for (const f of files) fd.append("images", f);
                  startUpload(async () => {
                    const res = await addGalleryImages(fd);
                    setStatus(res.ok ? { ok: true, msg: "Photos ajoutées." } : { ok: false, msg: res.error });
                    if (fileRef.current) fileRef.current.value = "";
                    if (res.ok) location.reload();
                  });
                }}
              />
            </li>
          ) : null}
        </ul>
        <p className="text-xs text-muted">JPG, PNG, WebP ou GIF, 5 Mo maximum par photo. Pensez à rendre la section « Galerie » visible ci-dessous.</p>
      </div>
      <SaveBar dirty={dirty} pending={pending} status={status} onReset={() => { setList(saved.images); setLay(saved.layout); setStatus(null); }} onSave={() => run(() => saveGallery({ images: list, layout: lay }), "Galerie enregistrée.", () => setSaved({ images: list, layout: lay }))} />
    </Card>
  );
}

/* ───────────────────────── Sections ───────────────────────── */

export const SECTION_LABELS: Partial<Record<PageSection, string>> = {
  about: "À propos",
  location: "Localisation (adresse et carte)",
  hours: "Horaires",
  gallery: "Galerie photos",
  reviews: "Avis clients",
  team: "L'équipe",
  faq: "Questions fréquentes",
};

export function SectionsEditor({ visible }: { visible: PageSection[] }) {
  const all = Object.keys(SECTION_LABELS) as PageSection[];
  const initial = [...visible.filter((s) => all.includes(s)).map((k) => ({ k, on: true })), ...all.filter((k) => !visible.includes(k)).map((k) => ({ k, on: false }))];
  const [saved, setSaved] = useState(initial);
  const [list, setList] = useState(initial);
  const { pending, status, setStatus, run } = useSaver();
  const dirty = JSON.stringify(list) !== JSON.stringify(saved);
  const move = (i: number, d: -1 | 1) => { setStatus(null); setList((l) => { const c = [...l]; [c[i], c[i + d]] = [c[i + d]!, c[i]!]; return c; }); };

  return (
    <Card>
      <CardHeader title="Sections de la page" description="Ce qui s'affiche à côté du calendrier, et dans quel ordre. La prise de rendez-vous reste toujours en premier." />
      <ul className="divide-y divide-border">
        {list.map((s, i) => (
          <li key={s.k} className={cn("flex items-center gap-3 px-5 py-2.5", !s.on && "text-muted")}>
            <button type="button" onClick={() => { setStatus(null); setList((l) => l.map((x, j) => (j === i ? { ...x, on: !x.on } : x))); }} className={cn("flex size-9 items-center justify-center rounded-lg", s.on ? "text-accent hover:bg-accent-soft" : "text-muted hover:bg-surface-muted")} aria-label={`${SECTION_LABELS[s.k]} : ${s.on ? "visible, cliquer pour masquer" : "masquée, cliquer pour afficher"}`} aria-pressed={s.on}>
              {s.on ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
            </button>
            <span className="flex-1 text-sm font-medium">{SECTION_LABELS[s.k]}</span>
            <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="flex size-8 items-center justify-center rounded text-muted hover:text-text disabled:opacity-25" aria-label={`Monter ${SECTION_LABELS[s.k]}`}><ArrowUp className="size-4" aria-hidden="true" /></button>
            <button type="button" disabled={i === list.length - 1} onClick={() => move(i, 1)} className="flex size-8 items-center justify-center rounded text-muted hover:text-text disabled:opacity-25" aria-label={`Descendre ${SECTION_LABELS[s.k]}`}><ArrowDown className="size-4" aria-hidden="true" /></button>
          </li>
        ))}
      </ul>
      <SaveBar dirty={dirty} pending={pending} status={status} onReset={() => { setList(saved); setStatus(null); }} onSave={() => run(() => saveSections(list.filter((s) => s.on).map((s) => s.k)), "Sections enregistrées.", () => setSaved(list))} />
    </Card>
  );
}

/* ───────────────────────── Réseaux sociaux et contact ───────────────────────── */

type Social = { website: string; instagram: string; facebook: string; whatsapp: string; tiktok: string; linkedin: string; youtube: string; show: { email: boolean; phone: boolean; instagram: boolean; facebook: boolean; whatsapp: boolean; website: boolean } };

export function SocialEditor({ initial, email, phone }: { initial: Social; email: string | null; phone: string | null }) {
  const [saved, setSaved] = useState(initial);
  const [v, setV] = useState(initial);
  const { pending, status, setStatus, run } = useSaver();
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const set = (patch: Partial<Social>) => { setV((x) => ({ ...x, ...patch })); setStatus(null); };
  const toggle = (k: keyof Social["show"]) => set({ show: { ...v.show, [k]: !v.show[k] } });

  const vis = (k: keyof Social["show"], label: string) => (
    <button type="button" onClick={() => toggle(k)} aria-pressed={v.show[k]} className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg border", v.show[k] ? "border-border-strong text-accent" : "border-border text-muted")} aria-label={`${label} : ${v.show[k] ? "affiché sur la page" : "masqué"}`} title={v.show[k] ? "Affiché sur la page" : "Masqué"}>
      {v.show[k] ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
    </button>
  );
  const fields: { k: "website" | "instagram" | "facebook" | "whatsapp" | "tiktok" | "linkedin" | "youtube"; label: string; ph: string; vis?: keyof Social["show"] }[] = [
    { k: "website", label: "Site web", ph: "https://www.mon-cabinet.be", vis: "website" },
    { k: "instagram", label: "Instagram", ph: "https://instagram.com/moncabinet", vis: "instagram" },
    { k: "facebook", label: "Facebook", ph: "https://facebook.com/moncabinet", vis: "facebook" },
    { k: "whatsapp", label: "WhatsApp", ph: "+32 470 00 00 00", vis: "whatsapp" },
    { k: "tiktok", label: "TikTok", ph: "https://tiktok.com/@moncabinet" },
    { k: "linkedin", label: "LinkedIn", ph: "https://linkedin.com/in/…" },
    { k: "youtube", label: "YouTube", ph: "https://youtube.com/@…" },
  ];

  return (
    <Card>
      <CardHeader title="Contact et réseaux sociaux" description="L'œil indique ce qui est affiché sur votre page." />
      <div className="space-y-3 p-5">
        {[
          { k: "email" as const, label: "Email", value: email },
          { k: "phone" as const, label: "Téléphone", value: phone },
        ].map((c) => (
          <div key={c.k} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{c.label}</p>
              <p className="truncate text-sm text-muted">{c.value || <>Non renseigné — <Link href="/app/reglages/etablissement" className="text-accent hover:text-accent-hover">ajouter</Link></>}</p>
            </div>
            {vis(c.k, c.label)}
          </div>
        ))}
        <div className="border-t border-border pt-3" />
        {fields.map((f) => (
          <div key={f.k} className="flex items-end gap-3">
            <Field label={f.label} htmlFor={`soc-${f.k}`} className="flex-1">
              <Input id={`soc-${f.k}`} value={v[f.k]} onChange={(e) => set({ [f.k]: e.target.value } as Partial<Social>)} placeholder={f.ph} maxLength={200} />
            </Field>
            {f.vis ? vis(f.vis, f.label) : <span className="w-10 shrink-0" />}
          </div>
        ))}
      </div>
      <SaveBar dirty={dirty} pending={pending} status={status} onReset={() => { setV(saved); setStatus(null); }} onSave={() => run(() => saveSocial(v), "Réseaux enregistrés.", () => setSaved(v))} />
    </Card>
  );
}
