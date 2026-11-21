/**
 * Génère src/app/cursors.css depuis les dessins de src/lib/ui-prefs.ts (curseurs de la personnalisation).
 * Lancer : npx tsx scripts/gen-cursors.ts
 *
 * Le curseur choisi s'applique PARTOUT : tout élément hérite du curseur de son parent (les classes cursor-* et les styles
 * du navigateur ne remettent plus celui de Windows), les éléments cliquables prennent la « main » du thème, la saisie
 * de texte une barre en I du thème, et un bouton désactivé ou en cours de chargement garde la flèche du thème.
 */
import { writeFileSync } from "node:fs";
import { CURSORS } from "../src/lib/ui-prefs";

const url = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, "%27")}")`;
const CLICKABLE = ":is(a[href], button, [role='button'], [role='link'], [role='option'], [role='tab'], [role='radio'], [role='checkbox'], [role='switch'], [role='menuitem'], summary, select, label[for], input[type='checkbox'], input[type='radio'], input[type='submit'], input[type='button'], .cursor-pointer)";
const TEXT = ":is(input:not([type='checkbox'], [type='radio'], [type='submit'], [type='button'], [type='range'], [type='color'], [type='file']), textarea, [contenteditable='true'], [contenteditable=''])";
const OFF = ":is(:disabled, [aria-disabled='true'], [aria-busy='true'])";

/** Barre en I aux couleurs du curseur (contour blanc pour rester visible sur fond sombre comme clair). */
const IBEAM: Record<string, { color: string; size: number }> = { skydev: { color: "#4f46e5", size: 32 }, dot: { color: "#4f46e5", size: 32 }, neon: { color: "#22d3ee", size: 32 }, star: { color: "#b45309", size: 32 }, big: { color: "#111111", size: 48 } };
const ibeam = (color: string, s: number) => {
  const k = s / 32;
  const p = `M${11 * k} ${6 * k}h${10 * k}M${16 * k} ${6 * k}v${20 * k}M${11 * k} ${26 * k}h${10 * k}`;
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><path d="${p}" stroke="#fff" stroke-width="${5 * k}" stroke-linecap="round" fill="none"/><path d="${p}" stroke="${color}" stroke-width="${2.2 * k}" stroke-linecap="round" fill="none"/></svg>`,
    x: s / 2,
    y: s / 2,
  };
};

const lines = ["/* Généré par scripts/gen-cursors.ts : ne pas modifier à la main. */"];
for (const c of CURSORS) {
  if (!c.arrow || !c.pointer) continue;
  const root = `:root[data-cursor="${c.id}"]`;
  const arrow = `${url(c.arrow.svg)} ${c.arrow.x} ${c.arrow.y}, default`;
  const hand = `${url(c.pointer.svg)} ${c.pointer.x} ${c.pointer.y}, pointer`;
  const ib = ibeam(IBEAM[c.id]?.color ?? "#111111", IBEAM[c.id]?.size ?? 32);
  lines.push(`${root}, ${root} body { cursor: ${arrow}; }`);
  lines.push(`${root} *, ${root} *::before, ${root} *::after { cursor: inherit; }`);
  lines.push(`${root} ${CLICKABLE} { cursor: ${hand}; }`);
  lines.push(`${root} ${TEXT} { cursor: ${url(ib.svg)} ${ib.x} ${ib.y}, text; }`);
  lines.push(`${root} ${CLICKABLE}${OFF}, ${root} ${CLICKABLE}.cursor-default, ${root} ${TEXT}${OFF}, ${root} ${OFF} * { cursor: ${arrow}; }`);
}
writeFileSync(new URL("../src/app/cursors.css", import.meta.url), lines.join("\n") + "\n");
console.log("✔ src/app/cursors.css");
