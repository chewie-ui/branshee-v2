"use client";

import { useRef, useState } from "react";
import { Bold, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Loader2, Quote, Underline } from "lucide-react";
import { cn } from "@/lib/cn";

type Tool = { key: string; icon: typeof Bold; label: string; cmd: string; value?: string; heading?: boolean };
const TOOLS: Tool[] = [
  { key: "b", icon: Bold, label: "Gras", cmd: "bold" },
  { key: "i", icon: Italic, label: "Italique", cmd: "italic" },
  { key: "u", icon: Underline, label: "Souligné", cmd: "underline" },
  { key: "h2", icon: Heading2, label: "Titre", cmd: "formatBlock", value: "h2", heading: true },
  { key: "h3", icon: Heading3, label: "Sous-titre", cmd: "formatBlock", value: "h3", heading: true },
  { key: "q", icon: Quote, label: "Citation", cmd: "formatBlock", value: "blockquote", heading: true },
  { key: "ul", icon: List, label: "Liste à puces", cmd: "insertUnorderedList" },
  { key: "ol", icon: ListOrdered, label: "Liste numérotée", cmd: "insertOrderedList" },
  { key: "a", icon: Link2, label: "Lien", cmd: "createLink" },
];

/**
 * Éditeur de texte riche léger (contentEditable) pour l'équipe Branshee : réponses de l'aide, articles.
 * Le HTML produit est toujours nettoyé côté serveur à l'enregistrement et à l'affichage.
 */
export function RichTextEditor({
  initialHtml,
  onChange,
  label,
  minHeight = "min-h-40",
  headings = false,
  uploadImage,
}: {
  initialHtml: string;
  onChange: (html: string) => void;
  label: string;
  minHeight?: string;
  headings?: boolean;
  /** Si fourni : bouton « image » (téléversement puis insertion). */
  uploadImage?: (file: File) => Promise<string | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  function exec(cmd: string, value?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, value);
    onChange(ref.current?.innerHTML ?? "");
  }
  function run(t: Tool) {
    if (t.cmd !== "createLink") return exec(t.cmd, t.value);
    const url = window.prompt("Adresse du lien (https://… ou /page)");
    if (url && /^(https?:\/\/|\/|mailto:)/i.test(url.trim())) exec("createLink", url.trim());
  }
  const tools = headings ? TOOLS : TOOLS.filter((t) => !t.heading);
  return (
    <div className="overflow-hidden rounded-lg border border-border-strong focus-within:border-accent">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-surface-muted px-2 py-1.5" role="toolbar" aria-label={`Mise en forme : ${label}`}>
        {tools.map((t) => (
          <button key={t.key} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => run(t)} className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-text" aria-label={t.label} title={t.label}>
            <t.icon className="size-4" aria-hidden="true" />
          </button>
        ))}
        {uploadImage ? (
          <>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => fileRef.current?.click()} disabled={uploading} className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-text" aria-label="Insérer une image" title="Insérer une image">
              {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setUploading(true);
                const url = await uploadImage(f).finally(() => setUploading(false));
                if (url) exec("insertHTML", `<img src="${url.replace(/"/g, "")}" alt="">`);
              }}
            />
          </>
        ) : null}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
        className={cn("prose-article px-3 py-2.5 text-sm focus-visible:outline-none", minHeight)}
        dangerouslySetInnerHTML={{ __html: initialHtml }}
      />
    </div>
  );
}
