/** Assistant IA : règles pures (testées), partagées serveur / client. */

export type ChatTurn = { role: "user" | "assistant"; text: string };

export const MAX_TURNS = 20;
export const MAX_TEXT = 2000;
/** Volume total de l'historique envoyé à chaque question (coût borné). */
export const MAX_HISTORY_CHARS = 12_000;

/** Garde un historique propre : rôles connus, textes non vides et bornés, commence par l'utilisateur, finit par lui. */
export function cleanHistory(raw: unknown): ChatTurn[] | null {
  if (!Array.isArray(raw)) return null;
  const turns = raw
    .filter((t): t is ChatTurn => !!t && typeof t === "object" && (t.role === "user" || t.role === "assistant") && typeof t.text === "string")
    .map((t) => ({ role: t.role, text: t.text.trim().slice(0, MAX_TEXT) }))
    .filter((t) => t.text)
    .slice(-MAX_TURNS);
  while (turns.length && turns[0]!.role !== "user") turns.shift();
  if (!turns.length || turns[turns.length - 1]!.role !== "user") return null;
  // Deux messages du même rôle à la suite sont fusionnés (l'API attend une alternance).
  const out: ChatTurn[] = [];
  for (const t of turns) {
    const last = out[out.length - 1];
    if (last && last.role === t.role) last.text = `${last.text}\n\n${t.text}`.slice(0, MAX_TEXT * 2);
    else out.push({ ...t });
  }
  // Historique trop long : on garde les messages les plus récents.
  while (out.length > 1 && out.reduce((a, t) => a + t.text.length, 0) > MAX_HISTORY_CHARS) out.splice(0, out[1]!.role === "user" ? 1 : 2);
  while (out.length && out[0]!.role !== "user") out.shift();
  return out.length ? out : null;
}

/** Plafond de questions par jour et par entreprise : rien sans abonnement, un peu pendant l'essai. */
export const dailyLimit = (p: { source: string; isTrial: boolean }) => (p.source === "free" ? 0 : p.isTrial ? 15 : 300);

/**
 * Métiers de santé (liste plus large que le vocabulaire « patients ») : aucune donnée ne part chez un fournisseur d'IA.
 * Sans métier renseigné, on refuse aussi (sûr par défaut).
 */
const HEALTH = ["médic", "medic", "chirurg", "radiolog", "urolog", "pneumolog", "oncolog", "angiolog", "orl", "néphrolog", "nephrolog", "hématolog", "hematolog", "anesthés", "anesthes",
  "laboratoire", "logopèd", "logoped", "audioprothés", "audiopro", "pharmac", "maison de repos", "résidence services", "residence services", "santé", "clinique", "hôpital", "hopital", "polyclinique",
  "thérap", "therap", "physio", "kiné", "kine", "psy", "dentaire", "infirm", "sage-femme", "ostéo", "osteo", "podo", "orthop", "diét", "diet", "nutrition", "acupunct", "naturo", "homéo", "homeo",
  "sophro", "hypno", "réflexo", "reflexo", "chiro", "médecin", "medecin", "docteur", "dentist", "optic", "opticien", "vétérin", "veterin", "health", "clinic", "doctor", "huisarts", "tandarts", "apotheek", "zorg"];
export function assistantBlockedFor(businessType: string | null | undefined, isPatient: boolean) {
  const t = (businessType ?? "").trim().toLowerCase();
  if (!t || isPatient) return true;
  const words = t.split(/[^a-zà-ÿ]+/).filter(Boolean);
  return HEALTH.some((k) => (k.includes(" ") ? t.includes(k) : words.some((w) => w.startsWith(k))));
}

export type Segment = { kind: "text"; text: string } | { kind: "bold"; text: string } | { kind: "link"; text: string; href: string };

/**
 * Découpe une réponse en morceaux sûrs à afficher : texte, **gras**, et [liens](/app/…) internes uniquement.
 * Tout autre lien (http, javascript:…) reste du texte brut.
 */
export function segments(line: string): Segment[] {
  const out: Segment[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]{1,120})\]\((\/app(?:\/[A-Za-z0-9\-_/?=&.%]*)?)\)/g;
  let last = 0;
  for (const m of line.matchAll(re)) {
    if (m.index! > last) out.push({ kind: "text", text: line.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: "bold", text: m[1] });
    // Un lien qui sortirait de /app (« .. », « // ») reste du texte.
    else if (/\.\.|\/\//.test(m[3]!)) out.push({ kind: "text", text: m[0] });
    else out.push({ kind: "link", text: m[2]!, href: m[3]! });
    last = m.index! + m[0].length;
  }
  if (last < line.length) out.push({ kind: "text", text: line.slice(last) });
  return out;
}
