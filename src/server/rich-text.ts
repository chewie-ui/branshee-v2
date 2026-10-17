import "server-only";
import sanitizeHtml from "sanitize-html";

/**
 * Texte riche « À propos » : seules quelques balises de mise en forme passent
 * (gras, italique, souligné, listes, tailles). Tout le reste — scripts, liens,
 * attributs, styles arbitraires — est retiré, à l'enregistrement ET à l'affichage
 * (les anciennes données importées n'ont jamais été nettoyées).
 */
const SIZES = new Set(["text-sm", "text-lg", "text-xl"]);

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "div", "b", "strong", "i", "em", "u", "ul", "ol", "li", "span", "h3", "h4", "font"],
    allowedAttributes: { span: ["class"], font: ["size"] },
    allowedClasses: { span: [...SIZES] },
    transformTags: {
      // L'ancien éditeur produisait <font size="1..7"> : converti en classes de taille.
      font: (_tag, attrs) => {
        const n = Number(attrs.size);
        const cls = n && n <= 2 ? "text-sm" : n >= 6 ? "text-xl" : n >= 4 ? "text-lg" : "";
        const out: Record<string, string> = cls ? { class: cls } : {};
        return { tagName: "span", attribs: out };
      },
      div: "p",
    },
    exclusiveFilter: (frame) => frame.tag === "span" && !frame.text.trim() && !frame.attribs.class,
  }).trim();
}

/** Version texte, pour la description courte et les balises meta. */
export function richTextToPlain(html: string): string {
  return sanitizeHtml(html.replace(/<(br|\/p|\/li|\/h[34])\s*\/?>/gi, "\n"), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
