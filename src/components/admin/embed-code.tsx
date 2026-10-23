"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { embedCode, type EmbedFormat } from "@/lib/embed-platforms";

const FORMATS: { v: EmbedFormat; l: string }[] = [
  { v: "inline", l: "Calendrier dans la page" },
  { v: "popup", l: "Bouton (fenêtre)" },
  { v: "bubble", l: "Bulle flottante" },
  { v: "link", l: "Lien simple" },
];

/** Code d'intégration d'un établissement, pour l'installer sur son site sans passer par son compte. */
export function AdminEmbedCode({ origin, slug, accent }: { origin: string; slug: string; accent: string }) {
  const [format, setFormat] = useState<EmbedFormat>("inline");
  const [copied, setCopied] = useState(false);
  const code = embedCode({ origin, pageUrl: `${origin}/${slug}`, format, sections: ["booking", "profile", "reviews", "about", "hours"], autoHeight: true, width: "100%", height: 800, label: "Prendre rendez-vous", color: accent, side: "right" });
  return (
    <div className="space-y-3 p-5">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Format">
        {FORMATS.map((f) => (
          <button key={f.v} type="button" role="radio" aria-checked={format === f.v} onClick={() => setFormat(f.v)} className={cn("h-9 rounded-lg border px-3 text-sm font-medium transition-colors", format === f.v ? "border-accent bg-accent-soft text-accent-soft-foreground" : "border-border-strong hover:bg-surface-muted")}>
            {f.l}
          </button>
        ))}
      </div>
      <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-surface-muted p-3 text-xs leading-relaxed"><code>{code}</code></pre>
      <Button
        size="sm"
        variant="secondary"
        icon={copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* presse-papiers indisponible : le code reste sélectionnable */
          }
        }}
      >
        {copied ? "Copié" : "Copier le code"}
      </Button>
    </div>
  );
}
