/**
 * Génère src/app/cursors.css depuis les dessins de src/lib/ui-prefs.ts (curseurs de la personnalisation).
 * Lancer : npx tsx scripts/gen-cursors.ts
 */
import { writeFileSync } from "node:fs";
import { CURSORS } from "../src/lib/ui-prefs";

const url = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, "%27")}")`;
const CLICKABLE = ":is(a[href], button, [role='button'], [role='link'], [role='option'], [role='tab'], [role='radio'], [role='checkbox'], [role='switch'], [role='menuitem'], summary, select, label[for], input[type='checkbox'], input[type='radio'], input[type='submit'], input[type='button'], .cursor-pointer)";
const lines = ["/* Généré par scripts/gen-cursors.ts : ne pas modifier à la main. */"];
for (const c of CURSORS) {
  if (!c.arrow || !c.pointer) continue;
  const root = `:root[data-cursor="${c.id}"]`;
  lines.push(`${root}, ${root} body { cursor: ${url(c.arrow.svg)} ${c.arrow.x} ${c.arrow.y}, auto; }`);
  lines.push(`${root} ${CLICKABLE} { cursor: ${url(c.pointer.svg)} ${c.pointer.x} ${c.pointer.y}, pointer; }`);
}
// Saisie de texte et éléments désactivés : curseurs du système, toujours.
lines.push(`:root[data-cursor] :is(input:not([type='checkbox'], [type='radio'], [type='submit'], [type='button'], [type='range'], [type='color']), textarea, [contenteditable='true']) { cursor: text; }`);
lines.push(`:root[data-cursor] :is(:disabled, [aria-disabled='true']) { cursor: not-allowed; }`);
writeFileSync(new URL("../src/app/cursors.css", import.meta.url), lines.join("\n") + "\n");
console.log("✔ src/app/cursors.css");
