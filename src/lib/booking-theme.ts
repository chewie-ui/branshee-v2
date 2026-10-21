import { z } from "zod";
import type { BookingTheme } from "@/db/schema";

/**
 * Apparence de la page de réservation : valeurs par défaut, thèmes prêts à l'emploi,
 * validation et traduction en variables CSS. Partagé entre l'éditeur (client) et la page publique.
 */

export const FONTS = ["Inter", "Poppins", "Lato", "Montserrat", "Playfair Display", "Nunito", "Roboto", "Open Sans", "DM Sans", "Merriweather"] as const;

export type FullTheme = Required<Omit<BookingTheme, "pageBgImage" | "customFontUrl" | "customFontFamily" | "texts" | "daySelectedBg" | "daySelectedText" | "dayHoverBg" | "btnHoverBg">> &
  Pick<BookingTheme, "pageBgImage" | "customFontUrl" | "customFontFamily" | "daySelectedBg" | "daySelectedText" | "dayHoverBg" | "btnHoverBg"> & {
    texts: { calendarHelp: string; slotHeading: string; timezone: string };
  };

export const DEFAULT_THEME: FullTheme = {
  accentColor: "#4f46e5",
  accentText: "#ffffff",
  pageBg: "#f6f6f7",
  calBg: "#ffffff",
  textColor: "#18181b",
  dayBg: "#ffffff",
  dayAvailableColor: "#16a34a",
  dayBusyColor: "#ea580c",
  dayFullColor: "#ef4444",
  font: "Inter",
  radius: "md",
  borderStyle: "subtle",
  shadowStyle: "none",
  layout: "classic",
  texts: { calendarHelp: "", slotHeading: "", timezone: "" },
};

/** Thèmes prêts à l'emploi : un point de départ, tout reste modifiable ensuite. */
export const PRESETS: { key: string; name: string; theme: Partial<FullTheme> }[] = [
  { key: "classic", name: "Classique", theme: { accentColor: "#4f46e5", accentText: "#ffffff", pageBg: "#f6f6f7", calBg: "#ffffff", textColor: "#18181b", dayBg: "#ffffff", font: "Inter", radius: "md", borderStyle: "subtle", shadowStyle: "none" } },
  { key: "sante", name: "Santé", theme: { accentColor: "#0f766e", accentText: "#ffffff", pageBg: "#f0f7f6", calBg: "#ffffff", textColor: "#102a27", dayBg: "#ffffff", font: "Nunito", radius: "lg", borderStyle: "subtle", shadowStyle: "subtle" } },
  { key: "zen", name: "Zen", theme: { accentColor: "#7c6f57", accentText: "#ffffff", pageBg: "#f7f3ec", calBg: "#fffdf9", textColor: "#2e2a24", dayBg: "#fffdf9", font: "Lato", radius: "lg", borderStyle: "subtle", shadowStyle: "none" } },
  { key: "elegant", name: "Élégant", theme: { accentColor: "#1f2937", accentText: "#ffffff", pageBg: "#f5f5f4", calBg: "#ffffff", textColor: "#111827", dayBg: "#ffffff", font: "Playfair Display", radius: "sm", borderStyle: "medium", shadowStyle: "none" } },
  { key: "beaute", name: "Beauté", theme: { accentColor: "#be185d", accentText: "#ffffff", pageBg: "#fdf2f8", calBg: "#ffffff", textColor: "#3b0a24", dayBg: "#ffffff", font: "Poppins", radius: "lg", borderStyle: "subtle", shadowStyle: "medium" } },
  { key: "sport", name: "Sport", theme: { accentColor: "#ea580c", accentText: "#ffffff", pageBg: "#f4f4f5", calBg: "#ffffff", textColor: "#18181b", dayBg: "#ffffff", font: "Montserrat", radius: "sm", borderStyle: "strong", shadowStyle: "none" } },
  { key: "nuit", name: "Nuit", theme: { accentColor: "#a78bfa", accentText: "#1e1b4b", pageBg: "#0f0f14", calBg: "#1a1a22", textColor: "#f4f4f5", dayBg: "#22222c", font: "DM Sans", radius: "md", borderStyle: "subtle", shadowStyle: "none" } },
];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide.");
const optHex = z.union([hex, z.literal("")]).optional();
const safeUrl = z
  .string()
  .trim()
  .max(500)
  .refine((u) => u === "" || (/^https:\/\/[^\s"'<>()]+$/.test(u)), "L'adresse doit commencer par https://")
  .optional();

export const themeSchema = z.object({
  accentColor: hex,
  accentText: hex,
  pageBg: hex,
  calBg: hex,
  textColor: hex,
  dayBg: hex,
  daySelectedBg: optHex,
  daySelectedText: optHex,
  dayHoverBg: optHex,
  btnHoverBg: optHex,
  dayAvailableColor: hex,
  dayBusyColor: hex,
  dayFullColor: hex,
  font: z.enum(FONTS),
  customFontUrl: safeUrl,
  customFontFamily: z.string().trim().max(60).regex(/^[\p{L}\p{N} _-]*$/u, "Nom de police invalide.").optional(),
  radius: z.enum(["none", "sm", "md", "lg"]),
  borderStyle: z.enum(["none", "subtle", "medium", "strong"]),
  shadowStyle: z.enum(["none", "subtle", "medium", "strong"]),
  layout: z.enum(["classic", "split"]),
  pageBgImage: z
    .string()
    .max(500)
    .refine((u) => u === "" || /^\/(media|uploads)\/[\w./-]+$/.test(u) || /^https:\/\/[^\s"'<>()]+$/.test(u), "Image de fond invalide.")
    .optional(),
  texts: z.object({ calendarHelp: z.string().trim().max(200), slotHeading: z.string().trim().max(80), timezone: z.string().trim().max(60) }),
});

/** Complète un thème stocké (ancien ou partiel) avec les valeurs par défaut et écarte ce qui est invalide. */
export function resolveTheme(stored: Partial<BookingTheme> | null | undefined): FullTheme {
  const merged = { ...DEFAULT_THEME, ...(stored ?? {}), texts: { ...DEFAULT_THEME.texts, ...(stored?.texts ?? {}) } };
  const parsed = themeSchema.safeParse(merged);
  if (parsed.success) return parsed.data as FullTheme;
  // Champ par champ : un seul champ abîmé ne doit pas faire perdre tout le reste.
  const out = { ...DEFAULT_THEME } as Record<string, unknown>;
  const shape = themeSchema.shape as Record<string, z.ZodType>;
  for (const [k, v] of Object.entries(merged)) if (shape[k]?.safeParse(v).success) out[k] = v;
  return out as FullTheme;
}

/** Couleur légèrement assombrie (survol automatique). */
export function shade(color: string, amount = -0.1) {
  const n = parseInt(color.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amount < 0 ? c : 255 - c) * amount)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Mélange d'une couleur avec du blanc/noir, pour les fonds « doux ». */
export function mix(color: string, base: string, weight: number) {
  const a = parseInt(color.slice(1), 16);
  const b = parseInt(base.slice(1), 16);
  const ch = (s: number) => Math.round(((a >> s) & 255) * weight + ((b >> s) & 255) * (1 - weight));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

function isDark(color: string) {
  const n = parseInt(color.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 128;
}

/** Contraste WCAG entre deux couleurs #rrggbb (1 à 21). */
export function contrast(a: string, b: string) {
  const lum = (c: string) => {
    const n = parseInt(c.slice(1), 16);
    const [r, g, bl] = [16, 8, 0].map((s) => {
      const v = ((n >> s) & 255) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}

/**
 * Couleur de texte lisible sur un fond : celle choisie par le pro si le contraste suffit,
 * sinon du noir ou du blanc (le plus lisible des deux). Un thème personnalisé ne doit jamais rendre la page illisible.
 */
export function readable(fg: string, bg: string, min = 4.5) {
  if (contrast(fg, bg) >= min) return fg;
  return contrast("#111111", bg) >= contrast("#ffffff", bg) ? "#111111" : "#ffffff";
}

/** Texte secondaire : le plus proche possible du fond (discret) tout en restant lisible. */
export function muted(text: string, bg: string) {
  for (let w = 0.68; w < 1; w += 0.04) {
    const c = mix(text, bg, w);
    if (contrast(c, bg) >= 4.5) return c;
  }
  return text;
}

const RADII = { none: ["0px", "0px", "0px", "0px"], sm: ["2px", "4px", "6px", "8px"], md: ["4px", "6px", "8px", "12px"], lg: ["8px", "12px", "16px", "20px"] } as const;
const SHADOWS = { none: "none", subtle: "0 1px 2px rgb(0 0 0 / 0.05)", medium: "0 4px 12px rgb(0 0 0 / 0.08)", strong: "0 10px 30px rgb(0 0 0 / 0.14)" } as const;

const STATE = { warning: "#b45309", danger: "#b91c1c", success: "#15803d" } as const;
/** --warning / --warning-soft, etc. : lisibles sur le fond des cartes, clair ou sombre. */
function stateColors(bg: string, dark: boolean, text: string) {
  const out: Record<string, string> = {};
  for (const [k, base] of Object.entries(STATE)) {
    const soft = mix(base, bg, dark ? 0.22 : 0.1);
    const fg = dark ? shade(base, 0.45) : base;
    out[`--${k}-soft`] = soft;
    out[`--${k}`] = contrast(fg, soft) >= 4.5 ? fg : readable(text, soft);
  }
  return out;
}

/** Variables CSS appliquées à la page publique (elles surchargent les jetons du design system). */
export function themeVars(t: FullTheme): Record<string, string> {
  const dark = isDark(t.calBg);
  const text = readable(t.textColor, t.calBg);
  const accentText = readable(t.accentText, t.accentColor);
  const selBg = t.daySelectedBg || t.accentColor;
  const dayHover = t.dayHoverBg || mix(t.accentColor, t.dayBg, 0.08);
  // Survol automatique : plus foncé, ou plus clair si le texte du bouton y deviendrait illisible.
  const accentHover = t.btnHoverBg || [shade(t.accentColor, -0.12), shade(t.accentColor, 0.15), shade(t.accentColor, -0.25)].find((c) => contrast(accentText, c) >= 4.5) || shade(t.accentColor, -0.12);
  const border = t.borderStyle === "none" ? "transparent" : mix(text, t.calBg, t.borderStyle === "subtle" ? 0.12 : t.borderStyle === "medium" ? 0.22 : 0.4);
  const r = RADII[t.radius];
  const family = t.customFontFamily && t.customFontUrl ? `"${t.customFontFamily}"` : `"${t.font}"`;
  return {
    "--background": t.pageBg,
    "--surface": t.calBg,
    "--surface-muted": mix(text, t.calBg, dark ? 0.1 : 0.04),
    "--border": border,
    "--border-strong": t.borderStyle === "none" ? mix(text, t.calBg, 0.12) : mix(text, t.calBg, t.borderStyle === "strong" ? 0.5 : 0.2),
    "--text": text,
    "--text-muted": muted(text, t.calBg),
    "--accent": t.accentColor,
    "--accent-hover": accentHover,
    "--accent-hover-foreground": readable(accentText, accentHover),
    "--accent-foreground": accentText,
    // Liens et textes en couleur d'accent : lisibles sur le fond des cartes, même avec un accent très clair ou très sombre.
    "--accent-link": readable(t.accentColor, t.calBg),
    "--accent-soft": mix(t.accentColor, t.calBg, 0.1),
    "--accent-soft-foreground": readable(dark ? t.accentColor : shade(t.accentColor, -0.25), mix(t.accentColor, t.calBg, 0.1)),
    "--day-bg": t.dayBg,
    "--day-text": readable(text, t.dayBg),
    "--day-selected-bg": selBg,
    "--day-selected-text": readable(t.daySelectedText || t.accentText, selBg),
    "--day-hover-bg": dayHover,
    "--day-hover-text": readable(text, dayHover),
    "--day-available": t.dayAvailableColor,
    "--day-busy": t.dayBusyColor,
    "--day-full": t.dayFullColor,
    "--radius-sm": r[0],
    "--radius-md": r[1],
    "--radius-lg": r[2],
    "--radius-xl": r[3],
    "--card-shadow": SHADOWS[t.shadowStyle],
    "--font-sans": `${family}, ui-sans-serif, system-ui, sans-serif`,
    // Couleurs d'état (créneaux conseillés, erreurs, succès) recalculées sur le fond des cartes :
    // fond doux teinté + texte lisible, au lieu des fonds clairs du thème par défaut.
    ...stateColors(t.calBg, dark, text),
    // Listes déroulantes, cases et barres de défilement du navigateur dans le bon thème (clair / sombre).
    "--bp-scheme": dark ? "dark" : "light",
  };
}

/** Feuille de style à charger pour la police choisie (Google Fonts), ou la police importée. */
export function fontStylesheet(t: FullTheme): string | null {
  if (t.customFontUrl && t.customFontFamily) return t.customFontUrl;
  if (t.font === "Inter") return null; // déjà embarquée
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(t.font).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`;
}

/** Thème transmis en aperçu (`?apercu=`), encodé en base64url. */
export function encodePreview(t: FullTheme) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(t)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decodePreview(s: string | undefined): FullTheme | null {
  if (!s || s.length > 6000) return null;
  try {
    const json = decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
    return resolveTheme(JSON.parse(json));
  } catch {
    return null;
  }
}
