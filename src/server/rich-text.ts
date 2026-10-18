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

/**
 * Articles du blog et réponses du centre d'aide (rédigés par l'équipe Branshee) :
 * titres, liens, images, citations, tableaux simples. Aucun script, style ni gestionnaire d'événement.
 */
export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "b", "strong", "i", "em", "u", "s", "ul", "ol", "li", "h2", "h3", "h4", "a", "img", "blockquote", "figure", "figcaption", "hr", "code", "pre", "table", "thead", "tbody", "tr", "th", "td"],
    allowedAttributes: { a: ["href", "target", "rel"], img: ["src", "alt", "width", "height", "loading"] },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
    transformTags: {
      div: "p",
      h1: "h2",
      a: (_tag, attrs) => {
        const external = /^https?:/i.test(attrs.href ?? "");
        return { tagName: "a", attribs: { href: attrs.href ?? "#", ...(external ? { target: "_blank", rel: "noopener noreferrer" } : {}) } };
      },
      img: (_tag, attrs) => ({ tagName: "img", attribs: { src: attrs.src ?? "", alt: attrs.alt ?? "", loading: "lazy" } }),
    },
    // Images hébergées par Branshee (/media/…) acceptées en plus des URL https.
    exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
  }).trim();
}
