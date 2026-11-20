/**
 * Personnalisation de l'espace pro, propre à chaque utilisateur (elle le suit sur tous ses appareils) :
 * thème, couleur, curseur, confort de lecture, notifications et sons.
 */

export const THEMES = [
  { id: "light", label: "Clair" },
  { id: "dark", label: "Sombre" },
  { id: "auto", label: "Comme l'ordinateur" },
] as const;
export type ThemeId = (typeof THEMES)[number]["id"];

/** Couleurs d'accent : contrastes vérifiés dans les deux thèmes (texte blanc sur l'accent en clair, foncé en sombre). */
export const ACCENTS = [
  { id: "indigo", label: "Indigo", swatch: "#4f46e5" },
  { id: "blue", label: "Bleu", swatch: "#1d4ed8" },
  { id: "violet", label: "Violet", swatch: "#7c3aed" },
  { id: "green", label: "Vert", swatch: "#047857" },
  { id: "rose", label: "Rose", swatch: "#be123c" },
  { id: "orange", label: "Orange", swatch: "#c2410c" },
] as const;
export type AccentId = (typeof ACCENTS)[number]["id"];

/**
 * Curseurs : une image pour la flèche et une pour les éléments cliquables (`pointer`), avec leur point actif.
 * Les styles CSS sont générés depuis ces dessins (scripts/gen-cursors.ts → src/app/cursors.css).
 */
type CursorArt = { svg: string; x: number; y: number };
const ARROW = "M5 3v22l6-6 4.2 9.3 3.8-1.7L14.8 17.6H23z";
const BIG_ARROW = "M7 4v33l9-9 6.3 14 5.7-2.6-6.3-13.9H35z";
const STAR = (cx: number, cy: number, r: number) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  });
  return `M${pts.join("L")}Z`;
};
const svg = (size: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;
const NEON_DEFS = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#e879f9"/></linearGradient></defs>`;

export const CURSORS: { id: string; label: string; arrow?: CursorArt; pointer?: CursorArt }[] = [
  { id: "default", label: "Classique" },
  {
    id: "skydev",
    label: "Étoile skydev",
    arrow: { svg: svg(32, `<path d="${ARROW}" fill="#4f46e5" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="${STAR(25, 7, 5)}" fill="#a5b4fc" stroke="#fff" stroke-width="1"/>`), x: 5, y: 3 },
    pointer: { svg: svg(32, `<path d="${ARROW}" fill="#fff" stroke="#4f46e5" stroke-width="2" stroke-linejoin="round"/><path d="${STAR(25, 7, 6)}" fill="#4f46e5" stroke="#fff" stroke-width="1"/>`), x: 5, y: 3 },
  },
  {
    id: "dot",
    label: "Point",
    arrow: { svg: svg(32, `<circle cx="16" cy="16" r="5.5" fill="#4f46e5" stroke="#fff" stroke-width="2"/>`), x: 16, y: 16 },
    pointer: { svg: svg(32, `<circle cx="16" cy="16" r="11" fill="rgba(79,70,229,.18)" stroke="#4f46e5" stroke-width="2"/><circle cx="16" cy="16" r="3" fill="#4f46e5"/>`), x: 16, y: 16 },
  },
  {
    id: "neon",
    label: "Néon",
    arrow: { svg: svg(32, `${NEON_DEFS}<path d="${ARROW}" fill="#0b1020" stroke="url(#g)" stroke-width="2.2" stroke-linejoin="round"/>`), x: 5, y: 3 },
    pointer: { svg: svg(32, `${NEON_DEFS}<path d="${ARROW}" fill="url(#g)" stroke="#0b1020" stroke-width="1.6" stroke-linejoin="round"/>`), x: 5, y: 3 },
  },
  {
    id: "star",
    label: "Étoile dorée",
    arrow: { svg: svg(32, `<path d="${STAR(16, 16, 12)}" fill="#fbbf24" stroke="#92400e" stroke-width="1.5" stroke-linejoin="round"/>`), x: 16, y: 16 },
    pointer: { svg: svg(32, `<path d="${STAR(16, 16, 14)}" fill="#f59e0b" stroke="#78350f" stroke-width="1.8" stroke-linejoin="round"/><circle cx="16" cy="16" r="2.5" fill="#78350f"/>`), x: 16, y: 16 },
  },
  {
    id: "big",
    label: "Grand (plus visible)",
    arrow: { svg: svg(48, `<path d="${BIG_ARROW}" fill="#111" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/>`), x: 7, y: 4 },
    pointer: { svg: svg(48, `<path d="${BIG_ARROW}" fill="#4f46e5" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/>`), x: 7, y: 4 },
  },
];
export type CursorId = string;

export const SOUNDS = [
  { id: "bulle", label: "Bulle" },
  { id: "carillon", label: "Carillon" },
  { id: "cloche", label: "Clochette" },
  { id: "douce", label: "Douce" },
  { id: "arcade", label: "Arcade" },
] as const;
export type SoundId = (typeof SOUNDS)[number]["id"];

export type UiPrefs = {
  theme: ThemeId;
  accent: AccentId;
  cursor: CursorId;
  textSize: "normal" | "large";
  reduceMotion: boolean;
  /** Bulle de notification dans le site (en bas de l'écran). */
  notifSite: boolean;
  /** Notification de l'ordinateur (Windows, Mac) quand l'onglet n'est pas au premier plan. */
  notifDesktop: boolean;
  sound: boolean;
  volume: number;
  soundNotif: SoundId;
  soundBooking: SoundId;
};

export const DEFAULT_PREFS: UiPrefs = { theme: "light", accent: "indigo", cursor: "default", textSize: "normal", reduceMotion: false, notifSite: true, notifDesktop: false, sound: true, volume: 70, soundNotif: "bulle", soundBooking: "carillon" };

const oneOf = <T extends string>(v: unknown, list: readonly { id: T }[] | readonly T[], fallback: T): T => {
  const ids = (list as readonly (T | { id: T })[]).map((x) => (typeof x === "string" ? x : x.id));
  return typeof v === "string" && ids.includes(v as T) ? (v as T) : fallback;
};

/** Préférences propres (valeurs inconnues → valeur par défaut). */
export function cleanPrefs(raw: unknown): UiPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_PREFS;
  const bool = (v: unknown, f: boolean) => (typeof v === "boolean" ? v : f);
  const vol = typeof r.volume === "number" && Number.isFinite(r.volume) ? Math.min(Math.max(Math.round(r.volume), 0), 100) : d.volume;
  return {
    theme: oneOf(r.theme, THEMES, d.theme),
    accent: oneOf(r.accent, ACCENTS, d.accent),
    cursor: oneOf(r.cursor, CURSORS, d.cursor),
    textSize: oneOf(r.textSize, ["normal", "large"] as const, d.textSize),
    reduceMotion: bool(r.reduceMotion, d.reduceMotion),
    notifSite: bool(r.notifSite, d.notifSite),
    notifDesktop: bool(r.notifDesktop, d.notifDesktop),
    sound: bool(r.sound, d.sound),
    volume: vol,
    soundNotif: oneOf(r.soundNotif, SOUNDS, d.soundNotif),
    soundBooking: oneOf(r.soundBooking, SOUNDS, d.soundBooking),
  };
}

/** Attributs posés sur <html> (lus par la feuille de style). */
export function prefsAttributes(p: UiPrefs): Record<string, string> {
  return { "data-theme": p.theme, "data-accent": p.accent, "data-cursor": p.cursor, "data-text": p.textSize, "data-motion": p.reduceMotion ? "reduce" : "normal" };
}

/** Clé du stockage local où l'espace pro garde une copie de la personnalisation (affichage sans flash). */
export const PREFS_STORAGE_KEY = "skydev-ui";

/**
 * Script de la page (dans <head>, avant l'affichage) : espace pro seulement, applique la dernière personnalisation
 * connue sur cet appareil, sans flash. La personnalisation du compte la remplace dès le chargement.
 */
export const EARLY_PREFS_SCRIPT = String.raw`(function(){try{var l=location;if(!(/^pro\./.test(l.hostname)||/^\/app(\/|$)/.test(l.pathname)))return;var a=JSON.parse(localStorage.getItem("skydev-ui")||"null");if(!a)return;var e=document.documentElement;for(var k in a)if(/^data-[a-z]+$/.test(k))e.setAttribute(k,String(a[k]));}catch(_){}})();`;
