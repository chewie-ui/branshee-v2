import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionTitle } from "@/components/site/section";
import { METIERS, VILLES } from "@/lib/seo-landing";

export const metadata: Metadata = {
  title: "Logiciel de prise de rendez-vous par métier et par ville",
  description: "Agenda et prise de rendez-vous en ligne pour kinés, ostéopathes, coiffeurs, esthéticiennes, psychologues… à Bruxelles, Liège, Namur, Charleroi et ailleurs.",
  alternates: { canonical: "/logiciel-rendez-vous" },
};

export default function SeoHub() {
  return (
    <Section>
      <SectionTitle title="La prise de rendez-vous en ligne, par métier et par ville" sub="Choisissez votre métier et votre ville : ce que Branshee change concrètement pour vous, et les professionnels déjà présents près de chez vous." />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {METIERS.map((m) => (
          <div key={m.slug} className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold first-letter:uppercase">{m.pluriel}</h2>
            <p className="mt-1 text-sm text-muted">{m.accroche}</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {VILLES.map((v) => (
                <li key={v.slug}>
                  <Link href={`/logiciel-rendez-vous/${m.slug}-${v.slug}`} className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm text-muted hover:border-border-strong hover:text-text">{v.nom}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
