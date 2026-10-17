/**
 * Consignes d'intégration par plateforme (reprises de l'ancien Branshee, vérifiées en août 2026).
 * `script: false` = l'ajustement automatique de la hauteur n'y fonctionne pas (cadre sandboxé).
 * `overlay: false` = un panneau superposé (bouton / bulle) n'y est pas possible.
 */
export type Platform = { key: string; name: string; script: boolean; overlay?: boolean; steps: string[]; note?: string; noteScript?: string };

export const PLATFORMS: Platform[] = [
  {
    key: "wordpress",
    name: "WordPress",
    script: true,
    steps: ["Ouvrez la page voulue, puis cliquez sur « Modifier ».", "Cliquez sur le « + » pour ajouter un bloc, et cherchez « HTML personnalisé ».", "Collez le code ci-dessous dans le bloc.", "Cliquez sur « Mettre à jour » : c’est en ligne."],
    note: "Sur WordPress.com (l’hébergé, pas le WordPress installé chez vous), les formules d’entrée retirent le JavaScript : cochez alors « hauteur fixe » ci-dessous.",
    noteScript: "Sur WordPress.com (l’hébergé), les formules d’entrée retirent le JavaScript : ce format n’y fonctionnera pas. Prenez « Calendrier dans la page » ou « Lien simple ».",
  },
  {
    key: "wix",
    name: "Wix",
    script: false,
    overlay: false,
    steps: ["Dans l’éditeur, cliquez sur « + Ajouter des éléments » puis « Intégrer le code ».", "Choisissez « Code d’intégration HTML » (Embed HTML).", "Cliquez sur « Entrer le code » et collez le code ci-dessous.", "Faites glisser les bords du cadre pour lui donner la hauteur voulue, puis publiez."],
    note: "Wix place toute intégration dans un cadre à hauteur fixe : l’ajustement automatique n’y fonctionne pas. Réglez la hauteur ci-dessous, ou étirez le cadre dans l’éditeur.",
    noteScript: "Wix enferme toute intégration dans un petit cadre : un bouton qui ouvre un panneau par-dessus la page n’y est pas possible. Prenez « Calendrier dans la page » ou « Lien simple ».",
  },
  {
    key: "webador",
    name: "Webador",
    script: true,
    steps: ["Dans l’éditeur, faites glisser l’élément « Code intégré » depuis le menu de gauche sur votre page.", "Cliquez sur l’élément, puis sur « Modifier le code intégré ».", "Collez le code ci-dessous dans le champ, et enregistrez."],
    note: "L’élément « Code intégré » demande une formule Lite, Pro ou Business : il n’existe pas sur la formule gratuite.",
    noteScript: "L’élément « Code intégré » demande une formule Lite, Pro ou Business : il n’existe pas sur la formule gratuite.",
  },
  {
    key: "squarespace",
    name: "Squarespace",
    script: true,
    steps: ["Ouvrez la page, cliquez sur « Modifier », puis sur un « + » pour ajouter un bloc.", "Choisissez le bloc « Code ».", "Collez le code ci-dessous et laissez le type sur « HTML ».", "Enregistrez, puis publiez."],
    note: "Le JavaScript et les iframes demandent une formule payante (Core ou supérieure). Sur la formule d’entrée, mettez plutôt un simple lien vers votre page de réservation.",
    noteScript: "Le JavaScript demande une formule payante (Core ou supérieure). Sur la formule d’entrée, choisissez « Lien simple ».",
  },
  { key: "jimdo", name: "Jimdo", script: true, steps: ["Passez le site en mode édition, survolez l’endroit voulu et cliquez sur « Ajouter un élément ».", "Ouvrez « Autres éléments et modules », puis choisissez « Widget/HTML ».", "Collez le code ci-dessous dans l’élément et enregistrez."] },
  { key: "shopify", name: "Shopify", script: true, steps: ["Administration Shopify → Boutique en ligne → Pages.", "Ouvrez la page voulue, puis passez l’éditeur en mode HTML (bouton « <> »).", "Collez le code ci-dessous.", "Enregistrez."] },
  { key: "webflow", name: "Webflow", script: true, steps: ["Dans le Designer, glissez un élément « Embed » à l’endroit voulu.", "Collez le code ci-dessous dans la fenêtre qui s’ouvre, puis enregistrez.", "Publiez le site pour que l’intégration soit visible en ligne."] },
  {
    key: "autre",
    name: "Autre site",
    script: true,
    steps: ["Ouvrez le fichier ou l’éditeur HTML de la page voulue.", "Collez le code ci-dessous à l’endroit où le calendrier doit apparaître.", "Enregistrez et publiez."],
    note: "Si votre outil refuse le JavaScript, ou si le calendrier apparaît coupé, cochez « hauteur fixe » ci-dessous : l’iframe seule fonctionne partout.",
    noteScript: "Ce format a besoin du JavaScript. Si votre outil le refuse, prenez « Calendrier dans la page » ou « Lien simple ».",
  },
];

export type EmbedFormat = "inline" | "popup" | "bubble" | "link";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Code à coller sur le site du pro. Compatible avec les codes générés par l'ancien Branshee. */
export function embedCode(o: { origin: string; pageUrl: string; format: EmbedFormat; sections: string[]; autoHeight: boolean; width: string; height: number; label: string; color: string; side: "left" | "right" }) {
  const all = ["booking", "profile", "reviews", "about", "hours"];
  const url = o.sections.length >= all.length ? o.pageUrl : `${o.pageUrl}?sections=${o.sections.join(",")}`;
  const label = o.label.trim() || "Prendre rendez-vous";
  if (o.format === "link") {
    return `<a href="${o.pageUrl}"\n   target="_blank" rel="noopener"\n   style="display:inline-block;padding:13px 22px;border-radius:10px;background:${o.color};color:#fff;font-weight:600;text-decoration:none;">\n  ${esc(label)}\n</a>`;
  }
  if (o.format === "popup" || o.format === "bubble") {
    const attrs = [`  src="${o.origin}/js/embed.js"`, `  data-branshee-url="${url}"`, `  data-branshee-mode="${o.format}"`, `  data-branshee-label="${esc(label)}"`, `  data-branshee-color="${o.color}"`];
    if (o.format === "bubble") attrs.push(`  data-branshee-position="${o.side}"`);
    return `<script\n${attrs.join("\n")}\n></script>`;
  }
  const w = /^\d+$/.test(o.width.trim()) ? `${o.width.trim()}px` : o.width.trim() || "100%";
  if (!o.autoHeight) {
    return `<iframe\n  src="${url}"\n  width="${w}"\n  height="${o.height}"\n  frameborder="0"\n  style="border-radius:12px;border:none;display:block;"\n  title="Réservation en ligne"\n  loading="lazy"\n  allow="payment"\n></iframe>`;
  }
  return (
    `<iframe\n  id="branshee-iframe"\n  src="${url}"\n  width="${w}"\n  height="700px"\n  frameborder="0"\n  scrolling="no"\n  style="border-radius:12px;border:none;display:block;overflow:hidden;"\n  title="Réservation en ligne"\n  loading="lazy"\n  allow="payment"\n></iframe>\n` +
    `<script>\n(function(){\n  var _lh=0;\n  window.addEventListener('message',function(e){\n    if(!e.data||e.data.type!=='branshee-resize')return;\n    var h=Math.min(e.data.height+24,6000);\n    if(Math.abs(h-_lh)<4)return;\n    _lh=h;\n    var fr=document.getElementsByTagName('iframe');\n    for(var i=0;i<fr.length;i++){\n      if(fr[i].contentWindow===e.source){\n        fr[i].style.height=h+'px';\n        break;\n      }\n    }\n  });\n})();\n</script>`
  );
}
