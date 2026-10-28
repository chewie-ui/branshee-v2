/** Assistant IA : règles pures (testées), partagées serveur / client. */

export type ChatTurn = { role: "user" | "assistant"; text: string };

export const MAX_TURNS = 20;
export const MAX_TEXT = 2000;

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
  return out;
}

/** Plafond de questions par jour et par entreprise. */
export const dailyLimit = (paid: boolean) => (paid ? 300 : 30);

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
    else out.push({ kind: "link", text: m[2]!, href: m[3]! });
    last = m.index! + m[0].length;
  }
  if (last < line.length) out.push({ kind: "text", text: line.slice(last) });
  return out;
}
