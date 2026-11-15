import { z } from "@/lib/zod";
import { FONTS, readable, shade } from "@/lib/booking-theme";

/**
 * Apparence de la carte de fidélité (page du client, espace client) : couleurs, police, icône des tampons,
 * logo et nom de l'entreprise. Les textes restent toujours lisibles (contraste ajusté automatiquement).
 */
export const STAMP_ICONS = ["star", "heart", "coffee", "sandwich", "pizza", "scissors", "sparkles", "dumbbell", "paw", "check"] as const;
export type StampIcon = (typeof STAMP_ICONS)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide.");
const img = z.string().max(500).refine((u) => u === "" || /^\/(media|uploads)\/[\w./-]+$/.test(u), "Image invalide.");
export const loyaltyThemeSchema = z.object({
  cardColor: hex,
  cardText: hex,
  pageBg: hex,
  font: z.enum(FONTS),
  icon: z.enum(STAMP_ICONS),
  radius: z.enum(["md", "lg", "xl"]),
  showLogo: z.boolean(),
  logoUrl: img,
  showName: z.boolean(),
  name: z.string().trim().max(60),
  title: z.string().trim().max(40),
  bgImage: img,
});
export type LoyaltyTheme = z.infer<typeof loyaltyThemeSchema>;

export const DEFAULT_LOYALTY_THEME: LoyaltyTheme = { cardColor: "#4f46e5", cardText: "#ffffff", pageBg: "#f6f6f7", font: "Inter", icon: "star", radius: "xl", showLogo: true, logoUrl: "", showName: true, name: "", title: "", bgImage: "" };

export const LOYALTY_PRESETS: { key: string; name: string; theme: Partial<LoyaltyTheme> }[] = [
  { key: "classique", name: "Classique", theme: { cardColor: "#4f46e5", cardText: "#ffffff", pageBg: "#f6f6f7", font: "Inter", icon: "star" } },
  { key: "snack", name: "Snack", theme: { cardColor: "#dc2626", cardText: "#ffffff", pageBg: "#fff7ed", font: "Poppins", icon: "sandwich" } },
  { key: "cafe", name: "Café", theme: { cardColor: "#6f4e37", cardText: "#fff8f0", pageBg: "#f5efe6", font: "Playfair Display", icon: "coffee" } },
  { key: "beaute", name: "Beauté", theme: { cardColor: "#be185d", cardText: "#ffffff", pageBg: "#fdf2f8", font: "Montserrat", icon: "sparkles" } },
  { key: "coiffure", name: "Coiffure", theme: { cardColor: "#18181b", cardText: "#ffffff", pageBg: "#f4f4f5", font: "DM Sans", icon: "scissors" } },
  { key: "sante", name: "Santé", theme: { cardColor: "#0f766e", cardText: "#ffffff", pageBg: "#f0fdfa", font: "Nunito", icon: "heart" } },
  { key: "sport", name: "Sport", theme: { cardColor: "#ea580c", cardText: "#ffffff", pageBg: "#fff7ed", font: "Montserrat", icon: "dumbbell" } },
  { key: "nature", name: "Nature", theme: { cardColor: "#3f6212", cardText: "#f7fee7", pageBg: "#f7fee7", font: "Lato", icon: "check" } },
];

/** Complète un thème stocké (partiel ou ancien), champ par champ. */
export function resolveLoyaltyTheme(stored: unknown): LoyaltyTheme {
  const merged = { ...DEFAULT_LOYALTY_THEME, ...((stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>) };
  const p = loyaltyThemeSchema.safeParse(merged);
  if (p.success) return p.data;
  const out: Record<string, unknown> = { ...DEFAULT_LOYALTY_THEME };
  const shape = loyaltyThemeSchema.shape as Record<string, z.ZodType>;
  for (const [k, v] of Object.entries(merged)) if (shape[k]?.safeParse(v).success) out[k] = v;
  return out as LoyaltyTheme;
}

/** Couleurs calculées : texte toujours lisible sur la carte, tampons pleins de la couleur de la carte. */
export function loyaltyColors(t: LoyaltyTheme) {
  const text = readable(t.cardText, t.cardColor, 4.5);
  const pageText = readable("#18181b", t.pageBg, 4.5);
  return { card: t.cardColor, text, stampOn: text, stampIcon: t.cardColor, ring: text, page: t.pageBg, pageText, edge: shade(t.cardColor, -0.15) };
}

export function loyaltyFontHref(t: LoyaltyTheme) {
  return t.font === "Inter" ? null : `https://fonts.googleapis.com/css2?family=${encodeURIComponent(t.font).replace(/%20/g, "+")}:wght@400;600;700&display=swap`;
}
