"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, PlayCircle, Search } from "lucide-react";
import { startTour } from "@/components/app/guided-tour";
import { Card, CardHeader } from "@/components/ui/card";
import { TOURS } from "@/lib/tours";

type Section = { id: string; title: string; videos: { id: string; title: string; url: string; duration?: string }[]; faqs: { id: string; question: string; answerHtml: string; answerText: string }[] };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function youtubeId(url: string) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m?.[1] ?? null;
}

/** Centre d'aide : recherche, visites guidées, vidéos et questions fréquentes. */
export function HelpCenter({ sections, toursTitle = "Visites guidées", showTours = true }: { sections: Section[]; toursTitle?: string; showTours?: boolean }) {
  const [q, setQ] = useState("");
  const needle = norm(q.trim());
  const match = (...parts: string[]) => !needle || parts.some((p) => norm(p).includes(needle));
  const tours = showTours ? TOURS.filter((t) => match(t.title, t.desc)) : [];
  const filtered = sections
    .map((s) => ({ ...s, videos: s.videos.filter((v) => match(v.title, s.title)), faqs: s.faqs.filter((f) => match(f.question, f.answerText, s.title)) }))
    .filter((s) => s.videos.length || s.faqs.length);
  const nothing = needle && !tours.length && !filtered.length;

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher : congé, rappel, équipe, paiement…"
          aria-label="Rechercher dans l'aide"
          className="h-11 w-full rounded-xl border border-border-strong bg-surface pr-3 pl-9 text-sm focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent/30"
        />
      </div>

      {!needle ? (
        <nav className="flex flex-wrap gap-2" aria-label="Chapitres">
          {[...(showTours ? [{ id: "visites", title: "Visites guidées" }] : []), ...sections.map((s) => ({ id: `s-${s.id}`, title: s.title })), { id: "contact", title: "Nous écrire" }].map((c) => (
            <a key={c.id} href={`#${c.id}`} className="rounded-full border border-border px-3 py-1 text-sm text-muted hover:border-border-strong hover:text-text">
              {c.title}
            </a>
          ))}
        </nav>
      ) : null}

      {nothing ? <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-muted">Aucun résultat pour « {q} ». Écrivez-nous ci-dessous : on vous répond.</p> : null}

      {tours.length ? (
        <Card id="visites" className="scroll-mt-6">
          <CardHeader title={toursTitle} description="On vous montre exactement où cliquer, en direct sur la page." />
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
            {tours.map((t) => (
              <button key={t.key} type="button" onClick={() => startTour(t.key)} className="group flex items-start gap-3 rounded-xl border border-border p-3 text-left hover:border-accent hover:bg-accent-soft/40">
                <span className="text-2xl leading-none" aria-hidden="true">{t.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{t.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{t.desc}</span>
                </span>
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted group-hover:text-accent" aria-hidden="true" />
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {filtered.map((s) => (
        <Card key={s.id} id={`s-${s.id}`} className="scroll-mt-6">
          <CardHeader title={s.title} />
          {s.videos.length ? (
            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {s.videos.map((v) => {
                const yt = v.url ? youtubeId(v.url) : null;
                const Inner = (
                  <>
                    <span className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-surface-muted">
                      {yt ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
                      ) : null}
                      <PlayCircle className="relative size-10 text-white drop-shadow" aria-hidden="true" />
                    </span>
                    <span className="mt-2 block text-sm font-medium">{v.title}</span>
                    <span className="block text-xs text-muted">{v.url ? v.duration || "Vidéo" : "Bientôt disponible"}</span>
                  </>
                );
                return v.url ? (
                  <a key={v.id} href={v.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl p-1 hover:bg-surface-muted">
                    {Inner}
                  </a>
                ) : (
                  <div key={v.id} className="p-1 opacity-70">{Inner}</div>
                );
              })}
            </div>
          ) : null}
          {s.faqs.length ? (
            <ul className="divide-y divide-border border-t border-border first:border-t-0">
              {s.faqs.map((f) => (
                <li key={f.id}>
                  <details className="group px-5 py-3" open={!!needle}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                      {f.question}
                      <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <div className="prose-sm mt-2 text-sm text-muted [&_a]:text-accent [&_a]:underline [&_strong]:text-text" dangerouslySetInnerHTML={{ __html: f.answerHtml }} />
                  </details>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
