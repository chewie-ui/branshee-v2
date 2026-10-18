import { ChevronDown } from "lucide-react";

/** FAQ en accordéons natifs (<details>) ; balisage FAQPage pour Google. */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })) };
  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
      {items.map((i) => (
        <details key={i.q} className="group px-5 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium [&::-webkit-details-marker]:hidden">
            {i.q}
            <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-muted">{i.a}</p>
        </details>
      ))}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </div>
  );
}
