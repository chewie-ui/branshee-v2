import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, MapPin } from "lucide-react";
import { Faq } from "@/components/site/faq";
import { Section } from "@/components/site/section";
import { VILLES, resolveSeo } from "@/lib/seo-landing";
import { businessesInCity, listArticles } from "@/server/site";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const t = resolveSeo((await params).slug);
  if (!t) return {};
  return {
    title: `Logiciel de prise de rendez-vous pour ${t.metier.nom} à ${t.ville.nom}`,
    description: `Agenda en ligne pour ${t.metier.pluriel} à ${t.ville.nom} : vos ${t.metier.clients} réservent 24 h/24, rappels automatiques, 0 % de commission. Gratuit pour commencer.`,
    alternates: { canonical: `/logiciel-rendez-vous/${t.slug}` },
  };
}

export default async function SeoLanding({ params }: { params: Params }) {
  const t = resolveSeo((await params).slug);
  if (!t) notFound();
  const { metier, ville } = t;
  const [pros, blog] = await Promise.all([businessesInCity(ville.nom, metier.motsCles), listArticles({ per: 4 })]);
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-accent"><MapPin className="size-4" aria-hidden="true" />{ville.nom} · {ville.region}</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">La prise de rendez-vous en ligne pour {metier.pluriel} à {ville.nom}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted">{metier.accroche}</p>
          <Link href="/inscription" className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-accent px-6 text-base font-medium text-accent-foreground hover:bg-accent-hover">Créer mon agenda gratuit<ArrowRight className="size-4" aria-hidden="true" /></Link>
          <p className="mt-3 text-sm text-muted">Sans carte bancaire · 0 % de commission · Sans engagement</p>
        </div>
      </section>

      <Section>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {metier.arguments.map((a) => (
            <div key={a.titre} className="rounded-2xl border border-border bg-surface p-6">
              <Check className="size-5 text-accent" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-semibold">{a.titre}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{a.texte}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section muted>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Exercer à {ville.nom}</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">{ville.contexte}</p>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">{ville.mobilite}</p>
            <p className="mt-4 text-sm text-muted">Quartiers et communes : {ville.zones.join(", ")}.</p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Déjà sur Branshee à {ville.nom}</h2>
            {pros.length ? (
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {pros.map((b) => (
                  <li key={b.id}>
                    <Link href={`/${b.slug}`} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 hover:border-border-strong">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-soft-foreground" aria-hidden="true">{b.name.slice(0, 2).toUpperCase()}</span>
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{b.name}</span><span className="block truncate text-xs text-muted">{b.type ?? "Professionnel"}</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-[15px] text-muted">Soyez parmi les premiers {metier.pluriel} de {ville.nom} à proposer la réservation en ligne : vos {metier.clients} vous trouveront dans <Link href="/annuaire" className="font-medium text-accent hover:text-accent-hover">l&apos;annuaire</Link>.</p>
            )}
          </div>
        </div>
      </Section>

      <Section>
        <h2 className="mb-6 text-center text-2xl font-semibold tracking-tight">Questions fréquentes</h2>
        <div className="mx-auto max-w-3xl"><Faq items={metier.faq.map((f) => ({ q: f.q, a: f.r }))} /></div>
        <div className="mx-auto mt-12 max-w-3xl">
          <p className="text-sm font-semibold">Ailleurs en Belgique</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {VILLES.filter((v) => v.slug !== ville.slug).map((v) => (
              <li key={v.slug}><Link href={`/logiciel-rendez-vous/${metier.slug}-${v.slug}`} className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm text-muted hover:text-text">{metier.nom} à {v.nom}</Link></li>
            ))}
          </ul>
        </div>
        {blog.rows.length ? (
          <div className="mx-auto mt-12 max-w-3xl">
            <p className="text-sm font-semibold">À lire sur le blog</p>
            <ul className="mt-3 space-y-2">
              {blog.rows.map((a) => <li key={a.slug}><Link href={`/blog/${a.slug}`} className="text-[15px] font-medium text-accent hover:text-accent-hover">{a.title}</Link></li>)}
            </ul>
          </div>
        ) : null}
      </Section>
    </>
  );
}
