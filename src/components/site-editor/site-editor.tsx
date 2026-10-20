"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ExternalLink, Eye, EyeOff, ImagePlus, Loader2, Plus, RotateCw, Trash2 } from "lucide-react";
import type { SocialLinks } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { cn } from "@/lib/cn";
import { SECTION_LABELS, SITE_FONTS, SITE_TEMPLATES, type SiteSection, type SiteTheme } from "@/lib/site-templates";
import { applySiteTemplate, saveSite, setSitePublished, uploadSiteImage } from "@/server/actions/site";

type State = { sections: SiteSection[]; theme: SiteTheme; seo: { title: string; description: string }; social: SocialLinks; logoUrl: string; customDomain: string };
type Props = { initial: State; published: boolean; publicUrl: string; visits: number; appHost: string };

const textarea = "w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/30";
const TABS = [
  { key: "content", label: "Contenu" },
  { key: "templates", label: "Modèles" },
  { key: "style", label: "Apparence" },
  { key: "settings", label: "Réglages" },
] as const;

async function upload(file: File) {
  const fd = new FormData();
  fd.set("file", file);
  const r = await uploadSiteImage(fd);
  return r.ok ? (r.url ?? null) : (window.alert(r.error), null);
}

function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-16 rounded-lg border border-border object-cover" />
        ) : (
          <span className="flex size-16 items-center justify-center rounded-lg border border-dashed border-border-strong text-muted"><ImagePlus className="size-5" aria-hidden="true" /></span>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => ref.current?.click()} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : undefined}>{value ? "Changer" : "Ajouter"}</Button>
          {value ? <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>Retirer</Button> : null}
        </div>
        <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label={label} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; setBusy(true); const u = await upload(f).finally(() => setBusy(false)); if (u) onChange(u); }} />
      </div>
    </div>
  );
}

/** Liste éditable d'éléments (valeurs, questions, images…). */
function ListEditor<T extends Record<string, unknown>>({ items, onChange, blank, max, render, addLabel }: { items: T[]; onChange: (v: T[]) => void; blank: T; max: number; render: (item: T, set: (p: Partial<T>) => void, i: number) => React.ReactNode; addLabel: string }) {
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="relative rounded-lg border border-border p-3 pr-11">
          {render(it, (p) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x))), i)}
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger" aria-label="Retirer cet élément"><Trash2 className="size-4" aria-hidden="true" /></button>
        </div>
      ))}
      {items.length < max ? <Button type="button" size="sm" variant="secondary" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => onChange([...items, { ...blank }])}>{addLabel}</Button> : null}
    </div>
  );
}

function SectionFields({ sec, set }: { sec: SiteSection; set: (data: Record<string, unknown>) => void }) {
  const d = sec.data;
  const v = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  const up = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set({ ...d, [k]: e.target.value });
  const id = (k: string) => `${sec.id}-${k}`;
  const T = (k: string, label: string, max = 160) => <Field label={label} htmlFor={id(k)}><Input id={id(k)} value={v(k)} onChange={up(k)} maxLength={max} /></Field>;
  const A = (k: string, label: string, max = 400) => <Field label={label} htmlFor={id(k)}><textarea id={id(k)} value={v(k)} onChange={up(k)} maxLength={max} rows={3} className={textarea} /></Field>;
  switch (sec.type) {
    case "hero":
      return (
        <>
          {T("title", "Titre")}
          {A("subtitle", "Sous-titre")}
          {T("ctaText", "Texte du bouton", 60)}
          <ImageField label="Image de fond" value={v("bgImage")} onChange={(u) => set({ ...d, bgImage: u })} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Alignement" htmlFor={id("align")}><Select id={id("align")} value={v("textAlign") || "center"} onChange={up("textAlign")}><option value="center">Centré</option><option value="left">À gauche</option></Select></Field>
            <Field label={`Assombrir l'image (${Number(d.overlayOpacity ?? 45)} %)`} htmlFor={id("ov")}><input id={id("ov")} type="range" min={35} max={85} value={Number(d.overlayOpacity ?? 45)} onChange={(e) => set({ ...d, overlayOpacity: Number(e.target.value) })} className="w-full accent-[var(--accent)]" /></Field>
          </div>
        </>
      );
    case "services":
      return <>{T("title", "Titre")}{T("subtitle", "Sous-titre", 300)}<p className="text-sm text-muted">Vos prestations actives s&apos;affichent automatiquement (Prestations).</p></>;
    case "booking":
      return (
        <>
          {T("title", "Titre")}
          {T("subtitle", "Sous-titre", 300)}
          <Field label="Affichage" htmlFor={id("mode")}><Select id={id("mode")} value={v("embedMode") || "full"} onChange={up("embedMode")}><option value="full">Calendrier avec présentation</option><option value="compact">Calendrier seul</option></Select></Field>
        </>
      );
    case "about":
      return (
        <>
          {T("subtitle", "Sur-titre (facultatif)", 80)}
          {T("title", "Titre")}
          <div><p className="mb-1.5 text-sm font-medium">Texte</p><RichTextEditor initialHtml={v("text")} onChange={(html) => set({ ...d, text: html })} label="Texte de la section À propos" minHeight="min-h-32" /></div>
          <ImageField label="Image" value={v("image")} onChange={(u) => set({ ...d, image: u })} />
          <p className="text-sm font-medium">Points forts</p>
          <ListEditor items={(d.values as { title: string; desc: string }[]) ?? []} onChange={(x) => set({ ...d, values: x })} blank={{ title: "", desc: "" }} max={6} addLabel="Ajouter un point fort" render={(it, s, i) => (<div className="grid gap-2"><Input value={it.title} onChange={(e) => s({ title: e.target.value })} placeholder="Titre" aria-label={`Titre du point fort ${i + 1}`} maxLength={80} /><Input value={it.desc} onChange={(e) => s({ desc: e.target.value })} placeholder="Description" aria-label={`Description du point fort ${i + 1}`} maxLength={240} /></div>)} />
        </>
      );
    case "gallery":
      return (
        <>
          {T("title", "Titre")}
          <Field label="Colonnes" htmlFor={id("cols")}><Select id={id("cols")} value={v("columns") || "3"} onChange={up("columns")}><option value="2">2</option><option value="3">3</option><option value="4">4</option></Select></Field>
          <ListEditor items={(d.images as { url: string; caption: string }[]) ?? []} onChange={(x) => set({ ...d, images: x })} blank={{ url: "", caption: "" }} max={24} addLabel="Ajouter une image" render={(it, s, i) => (<div className="space-y-2"><ImageField label={`Image ${i + 1}`} value={it.url} onChange={(u) => s({ url: u })} /><Input value={it.caption} onChange={(e) => s({ caption: e.target.value })} placeholder="Légende (facultatif)" aria-label={`Légende de l'image ${i + 1}`} maxLength={120} /></div>)} />
        </>
      );
    case "testimonials":
      return (
        <>
          {T("title", "Titre")}
          <Field label="Avis affichés" htmlFor={id("src")}><Select id={id("src")} value={v("source") || "reviews"} onChange={up("source")}><option value="reviews">Les avis vérifiés de votre page (recommandé)</option><option value="manual">Des avis que je recopie moi-même</option></Select></Field>
          {d.source === "manual" ? (
            <>
              <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">N&apos;indiquez que de vrais avis de vrais clients, avec leur accord. Des avis inventés sont interdits (pratique commerciale trompeuse).</p>
              <ListEditor items={(d.items as { name: string; rating: number; text: string }[]) ?? []} onChange={(x) => set({ ...d, items: x })} blank={{ name: "", rating: 5, text: "" }} max={12} addLabel="Ajouter un avis" render={(it, s, i) => (<div className="grid gap-2"><div className="flex gap-2"><Input value={it.name} onChange={(e) => s({ name: e.target.value })} placeholder="Prénom et initiale" aria-label={`Auteur de l'avis ${i + 1}`} maxLength={80} /><Select value={String(it.rating)} onChange={(e) => s({ rating: Number(e.target.value) })} className="w-24" aria-label={`Note de l'avis ${i + 1}`}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}/5</option>)}</Select></div><textarea value={it.text} onChange={(e) => s({ text: e.target.value })} rows={2} maxLength={600} className={textarea} aria-label={`Texte de l'avis ${i + 1}`} /></div>)} />
            </>
          ) : <p className="text-sm text-muted">Seuls les avis laissés par vos clients après un rendez-vous apparaissent. La section est masquée tant qu&apos;il n&apos;y en a pas.</p>}
        </>
      );
    case "faq":
      return (
        <>
          {T("title", "Titre")}
          <ListEditor items={(d.items as { question: string; answer: string }[]) ?? []} onChange={(x) => set({ ...d, items: x })} blank={{ question: "", answer: "" }} max={20} addLabel="Ajouter une question" render={(it, s, i) => (<div className="grid gap-2"><Input value={it.question} onChange={(e) => s({ question: e.target.value })} placeholder="Question" aria-label={`Question ${i + 1}`} maxLength={240} /><textarea value={it.answer} onChange={(e) => s({ answer: e.target.value })} placeholder="Réponse" rows={2} maxLength={1500} className={textarea} aria-label={`Réponse ${i + 1}`} /></div>)} />
        </>
      );
    case "stats":
      return (
        <>
          {T("title", "Titre")}
          <p className="text-sm text-muted">Uniquement des chiffres réels et vérifiables.</p>
          <ListEditor items={(d.items as { number: string; label: string }[]) ?? []} onChange={(x) => set({ ...d, items: x })} blank={{ number: "", label: "" }} max={6} addLabel="Ajouter un chiffre" render={(it, s, i) => (<div className="flex gap-2"><Input value={it.number} onChange={(e) => s({ number: e.target.value })} placeholder="15 ans" className="w-28" aria-label={`Chiffre ${i + 1}`} maxLength={20} /><Input value={it.label} onChange={(e) => s({ label: e.target.value })} placeholder="d'expérience" aria-label={`Libellé du chiffre ${i + 1}`} maxLength={80} /></div>)} />
        </>
      );
    case "cta":
      return <>{T("title", "Titre")}{A("text", "Texte")}{T("buttonText", "Texte du bouton", 60)}<Field label="Lien du bouton" htmlFor={id("url")} hint="#booking pour la réservation, ou une adresse https://"><Input id={id("url")} value={v("buttonUrl")} onChange={up("buttonUrl")} maxLength={300} /></Field></>;
    case "contact":
      return (
        <>
          {T("title", "Titre")}
          {T("address", "Adresse", 240)}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{T("phone", "Téléphone", 40)}{T("email", "Email", 160)}</div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.showForm !== false} onChange={(e) => set({ ...d, showForm: e.target.checked })} className="size-4 accent-[var(--accent)]" />Formulaire de contact (les messages arrivent dans votre boîte email)</label>
        </>
      );
    default:
      return null;
  }
}

export function SiteEditor({ initial, published: initialPublished, publicUrl, visits, appHost }: Props) {
  const [st, setSt] = useState<State>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("content");
  const [open, setOpen] = useState<string | null>(initial.sections[0]?.id ?? null);
  const [published, setPublished] = useState(initialPublished);
  const [frameKey, setFrameKey] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(st) !== saved;
  const patch = (p: Partial<State>) => setSt((s) => ({ ...s, ...p }));
  const setSections = (f: (l: SiteSection[]) => SiteSection[]) => setSt((s) => ({ ...s, sections: f(s.sections) }));
  const move = (i: number, dir: -1 | 1) => setSections((l) => { const c = [...l]; const j = i + dir; if (j < 0 || j >= c.length) return c; [c[i], c[j]] = [c[j]!, c[i]!]; return c; });

  const save = () =>
    start(async () => {
      const r = await saveSite({ ...st, theme: { ...st.theme, headingFont: (st.theme.headingFont ?? "") as SiteTheme["fontFamily"] } } as never);
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "Enregistré.") : (r.error ?? "Erreur.") });
      if (r.ok) { setSaved(JSON.stringify(st)); setFrameKey((k) => k + 1); }
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-medium">
            <span className={cn("size-2 rounded-full", published ? "bg-success" : "bg-border-strong")} aria-hidden="true" />
            {published ? "En ligne" : "Brouillon (non publié)"}
          </p>
          <p className="truncate text-sm text-muted">{published ? <a href={publicUrl} target="_blank" rel="noreferrer" className="hover:underline">{publicUrl.replace(/^https?:\/\//, "")}</a> : "Votre page de réservation reste affichée tant que le site n'est pas publié."} · {visits} visite{visits > 1 ? "s" : ""}</p>
        </div>
        {msg ? <p className={cn("text-sm", msg.ok ? "text-success" : "text-danger")} role="status">{msg.text}</p> : null}
        <Button variant="secondary" disabled={pending || !dirty} onClick={() => { setSt(JSON.parse(saved)); setMsg(null); }}>Annuler</Button>
        <Button loading={pending} disabled={!dirty} onClick={save}>Enregistrer</Button>
        <Button
          variant={published ? "secondary" : "primary"}
          disabled={pending || dirty}
          title={dirty ? "Enregistrez d'abord vos changements" : undefined}
          onClick={() => start(async () => { const r = await setSitePublished(!published); if (r.ok) setPublished(!published); setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "") : (r.error ?? "Erreur.") }); })}
        >
          {published ? "Retirer le site" : "Publier"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="rounded-xl border border-border bg-surface">
          <div className="flex border-b border-border" role="tablist" aria-label="Éditeur du site">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cn("-mb-px flex-1 border-b-2 px-2 py-3 text-sm font-medium", tab === t.key ? "border-accent text-text" : "border-transparent text-muted hover:text-text")}>{t.label}</button>
            ))}
          </div>
          <div className="max-h-[calc(100dvh-220px)] space-y-3 overflow-y-auto p-4">
            {tab === "content" ? (
              <>
                {st.sections.map((sec, i) => (
                  <div key={sec.id} className={cn("rounded-lg border", open === sec.id ? "border-accent" : "border-border")}>
                    <div className="flex items-center gap-1 px-2 py-1.5">
                      <button type="button" onClick={() => setOpen(open === sec.id ? null : sec.id)} aria-expanded={open === sec.id} className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1.5 text-left text-sm font-medium">
                        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open === sec.id && "rotate-180")} aria-hidden="true" />
                        <span className={cn("truncate", !sec.enabled && "text-muted line-through")}>{SECTION_LABELS[sec.type]}</span>
                      </button>
                      <button type="button" onClick={() => setSections((l) => l.map((x) => (x.id === sec.id ? { ...x, enabled: !x.enabled } : x)))} className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-muted" aria-label={sec.enabled ? `Masquer ${SECTION_LABELS[sec.type]}` : `Afficher ${SECTION_LABELS[sec.type]}`}>{sec.enabled ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}</button>
                      <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-muted disabled:opacity-30" aria-label="Monter"><ArrowUp className="size-4" aria-hidden="true" /></button>
                      <button type="button" disabled={i === st.sections.length - 1} onClick={() => move(i, 1)} className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-muted disabled:opacity-30" aria-label="Descendre"><ArrowDown className="size-4" aria-hidden="true" /></button>
                      <button type="button" onClick={() => setSections((l) => l.filter((x) => x.id !== sec.id))} className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-danger" aria-label={`Supprimer ${SECTION_LABELS[sec.type]}`}><Trash2 className="size-4" aria-hidden="true" /></button>
                    </div>
                    {open === sec.id ? <div className="space-y-3 border-t border-border p-3"><SectionFields sec={sec} set={(data) => setSections((l) => l.map((x) => (x.id === sec.id ? { ...x, data } : x)))} /></div> : null}
                  </div>
                ))}
                {adding ? (
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-dashed border-border-strong p-3">
                    {(Object.keys(SECTION_LABELS) as SiteSection["type"][]).filter((ty) => ty !== "booking" || !st.sections.some((x) => x.type === "booking")).map((ty) => (
                      <button key={ty} type="button" className="rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-accent" onClick={() => { const id = `${ty}-${Date.now().toString(36)}`; setSections((l) => [...l, { id, type: ty, enabled: true, data: { title: SECTION_LABELS[ty] } }]); setOpen(id); setAdding(false); }}>{SECTION_LABELS[ty]}</button>
                    ))}
                  </div>
                ) : (
                  <Button variant="secondary" className="w-full" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setAdding(true)} disabled={st.sections.length >= 20}>Ajouter une section</Button>
                )}
              </>
            ) : null}

            {tab === "templates" ? (
              <>
                <p className="text-sm text-muted">Un modèle remplace les textes, les sections et l&apos;apparence. Votre logo, vos réseaux, vos coordonnées et votre domaine sont gardés.</p>
                {SITE_TEMPLATES.map((t) => (
                  <div key={t.id} className="overflow-hidden rounded-lg border border-border">
                    <div className="flex h-20 items-end gap-2 p-3" style={{ background: t.thumb.bg, color: t.thumb.text }}>
                      <span className="text-lg font-semibold" style={{ fontFamily: t.theme.headingFont || t.theme.fontFamily }}>{t.name}</span>
                      <span className="mb-1 h-3 w-10 rounded-full" style={{ background: t.thumb.accent }} aria-hidden="true" />
                    </div>
                    <div className="space-y-2 p-3">
                      <p className="text-sm font-medium">{t.tagline}</p>
                      <p className="text-sm text-muted">{t.description}</p>
                      <Button size="sm" variant="secondary" disabled={pending} onClick={() => { if (!window.confirm(`Appliquer le modèle « ${t.name} » ? Vos sections actuelles seront remplacées.`)) return; start(async () => { const r = await applySiteTemplate(t.id); setMsg({ ok: r.ok, text: r.ok ? (r.message ?? "") : (r.error ?? "Erreur.") }); if (r.ok) window.location.reload(); }); }}>Appliquer ce modèle</Button>
                    </div>
                  </div>
                ))}
              </>
            ) : null}

            {tab === "style" ? (
              <>
                {([["primaryColor", "Couleur principale"], ["bgColor", "Fond"], ["textColor", "Texte"]] as const).map(([k, label]) => (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <label htmlFor={`c-${k}`} className="text-sm font-medium">{label}</label>
                    <span className="flex items-center gap-2">
                      <input id={`c-${k}`} type="color" value={st.theme[k]} onChange={(e) => patch({ theme: { ...st.theme, [k]: e.target.value } })} className="size-9 cursor-pointer rounded-md border border-border-strong bg-surface p-0.5" />
                      <code className="w-20 text-xs text-muted">{st.theme[k]}</code>
                    </span>
                  </div>
                ))}
                <Field label="Police du texte" htmlFor="f-body"><Select id="f-body" value={st.theme.fontFamily} onChange={(e) => patch({ theme: { ...st.theme, fontFamily: e.target.value } })}>{SITE_FONTS.map((f) => <option key={f}>{f}</option>)}</Select></Field>
                <Field label="Police des titres" htmlFor="f-head"><Select id="f-head" value={st.theme.headingFont ?? ""} onChange={(e) => patch({ theme: { ...st.theme, headingFont: e.target.value } })}><option value="">Identique au texte</option>{SITE_FONTS.map((f) => <option key={f}>{f}</option>)}</Select></Field>
                <Field label="Coins" htmlFor="f-round"><Select id="f-round" value={st.theme.roundness} onChange={(e) => patch({ theme: { ...st.theme, roundness: e.target.value as SiteTheme["roundness"] } })}><option value="sharp">Droits</option><option value="soft">Arrondis</option><option value="round">Très arrondis</option></Select></Field>
                <ImageField label="Logo" value={st.logoUrl} onChange={(u) => patch({ logoUrl: u })} />
                <p className="text-xs text-muted">Le texte des boutons passe automatiquement en noir ou en blanc pour rester lisible.</p>
              </>
            ) : null}

            {tab === "settings" ? (
              <>
                <p className="text-sm font-semibold">Référencement (Google)</p>
                <Field label={`Titre (${st.seo.title.length}/70)`} htmlFor="seo-t"><Input id="seo-t" value={st.seo.title} onChange={(e) => patch({ seo: { ...st.seo, title: e.target.value } })} maxLength={70} /></Field>
                <Field label={`Description (${st.seo.description.length}/170)`} htmlFor="seo-d"><textarea id="seo-d" value={st.seo.description} onChange={(e) => patch({ seo: { ...st.seo, description: e.target.value } })} maxLength={170} rows={3} className={textarea} /></Field>
                <p className="pt-2 text-sm font-semibold">Réseaux sociaux</p>
                {(["instagram", "facebook", "tiktok", "linkedin", "youtube", "whatsapp"] as const).map((k) => (
                  <Field key={k} label={k === "whatsapp" ? "WhatsApp (numéro)" : k[0]!.toUpperCase() + k.slice(1)} htmlFor={`so-${k}`}><Input id={`so-${k}`} value={st.social[k] ?? ""} onChange={(e) => patch({ social: { ...st.social, [k]: e.target.value } })} placeholder={k === "whatsapp" ? "+32 470 12 34 56" : "https://…"} maxLength={200} /></Field>
                ))}
                <p className="pt-2 text-sm font-semibold">Nom de domaine</p>
                <Field label="Votre domaine (facultatif)" htmlFor="dom" hint={`Chez votre registraire, créez un enregistrement CNAME de ce domaine vers ${appHost}. La mise en service (certificat HTTPS) est faite par l'équipe : écrivez-nous depuis Aide et support.`}>
                  <Input id="dom" value={st.customDomain} onChange={(e) => patch({ customDomain: e.target.value.trim().toLowerCase() })} placeholder="www.moncabinet.be" maxLength={120} />
                </Field>
              </>
            ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 text-sm text-muted">
            <span>Aperçu {dirty ? "(enregistrez pour voir vos changements)" : ""}</span>
            <span className="flex gap-1">
              <button type="button" onClick={() => setFrameKey((k) => k + 1)} className="flex size-8 items-center justify-center rounded-lg hover:bg-surface-muted" aria-label="Recharger l'aperçu"><RotateCw className="size-4" aria-hidden="true" /></button>
              <a href="/apercu-site" target="_blank" rel="noreferrer" className="flex size-8 items-center justify-center rounded-lg hover:bg-surface-muted" aria-label="Ouvrir l'aperçu dans un onglet"><ExternalLink className="size-4" aria-hidden="true" /></a>
            </span>
          </div>
          <iframe key={frameKey} src="/apercu-site" title="Aperçu du site" className="h-[calc(100dvh-220px)] min-h-[520px] w-full bg-white" />
        </div>
      </div>
    </div>
  );
}
