import { z } from "@/lib/zod";
import { FONTS, PRESETS, fontStylesheet, resolveTheme, themeVars } from "@/lib/booking-theme";

/**
 * Apparence de la boutique en ligne : couleurs, police, coins, bannière, mise en page.
 * Le moteur de thème de la page de réservation fait le reste (contrastes lisibles garantis, survols…).
 */
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide.");
export const shopThemeSchema = z.object({
  accentColor: hex,
  accentText: hex,
  pageBg: hex,
  calBg: hex,
  textColor: hex,
  font: z.enum(FONTS),
  radius: z.enum(["none", "sm", "md", "lg"]),
  shadowStyle: z.enum(["none", "subtle", "medium", "strong"]),
  layout: z.enum(["grid", "list"]),
  bannerUrl: z.string().max(500).refine((u) => u === "" || /^\/(media|uploads)\/[\w./-]+$/.test(u), "Bannière invalide."),
  title: z.string().trim().max(80),
});
export type ShopTheme = z.infer<typeof shopThemeSchema>;

export const DEFAULT_SHOP_THEME: ShopTheme = { accentColor: "#4f46e5", accentText: "#ffffff", pageBg: "#f6f6f7", calBg: "#ffffff", textColor: "#18181b", font: "Inter", radius: "md", shadowStyle: "none", layout: "grid", bannerUrl: "", title: "" };

/** Thèmes prêts à l'emploi (les mêmes que la page de réservation) + un thème « Snack » pour la restauration rapide. */
export const SHOP_PRESETS: { key: string; name: string; theme: Partial<ShopTheme> }[] = [
  ...PRESETS.map((p) => ({ key: p.key, name: p.name, theme: { accentColor: p.theme.accentColor, accentText: p.theme.accentText, pageBg: p.theme.pageBg, calBg: p.theme.calBg, textColor: p.theme.textColor, font: p.theme.font, radius: p.theme.radius, shadowStyle: p.theme.shadowStyle } as Partial<ShopTheme> })),
  { key: "snack", name: "Snack", theme: { accentColor: "#dc2626", accentText: "#ffffff", pageBg: "#fff7ed", calBg: "#ffffff", textColor: "#1c1917", font: "Poppins", radius: "lg", shadowStyle: "subtle" } },
];

/** Complète un thème stocké (partiel ou ancien) champ par champ. */
export function resolveShopTheme(stored: unknown): ShopTheme {
  const merged = { ...DEFAULT_SHOP_THEME, ...((stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>) };
  const parsed = shopThemeSchema.safeParse(merged);
  if (parsed.success) return parsed.data;
  const out: Record<string, unknown> = { ...DEFAULT_SHOP_THEME };
  const shape = shopThemeSchema.shape as Record<string, z.ZodType>;
  for (const [k, v] of Object.entries(merged)) if (shape[k]?.safeParse(v).success) out[k] = v;
  return out as ShopTheme;
}

const asBooking = (t: ShopTheme) => resolveTheme({ accentColor: t.accentColor, accentText: t.accentText, pageBg: t.pageBg, calBg: t.calBg, textColor: t.textColor, dayBg: t.calBg, font: t.font, radius: t.radius, shadowStyle: t.shadowStyle, borderStyle: "subtle" });
export const shopVars = (t: ShopTheme) => themeVars(asBooking(t));
export const shopFont = (t: ShopTheme) => fontStylesheet(asBooking(t));

/** Aperçu en direct depuis l'éditeur (`?theme=`), encodé en base64url ; invalide = ignoré. */
export const encodeShopTheme = (t: ShopTheme) => btoa(unescape(encodeURIComponent(JSON.stringify(t)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export function decodeShopTheme(s: string | undefined): ShopTheme | null {
  if (!s || s.length > 3000) return null;
  try {
    const json = Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const p = shopThemeSchema.safeParse(JSON.parse(json));
    return p.success ? p.data : null;
  } catch { return null; }
}
