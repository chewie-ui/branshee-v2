import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Adresses courtes des deux espaces Skydev :
 *   pro.skydev.be/agenda          → page /app/agenda
 *   client.skydev.be/fidelite     → page /espace-client/fidelite
 *
 * La liste des pages est lue dans src/app au démarrage du build (next.config), puis transmise au proxy
 * (variable SPACE_ROUTES, figée dans le build). Seules les pages qui existent vraiment sous /app ou
 * /espace-client sont réécrites : pro.skydev.be/boutique/<adresse> reste la boutique publique.
 *
 * Fichier lu uniquement par next.config (Node) : jamais importé par l'application.
 */
export type SpaceRoute = { source: string; regex: string };
export type SpaceRoutes = { pro: SpaceRoute[]; client: SpaceRoute[] };

const UUID = "[0-9a-fA-F-]{36}";

function walk(dir: string, segs: string[], out: string[][]) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name.startsWith("_") || name.startsWith("@")) continue;
      walk(full, /^\(.*\)$/.test(name) ? segs : [...segs, name], out);
    } else if (/^(page|route)\.(tsx?|jsx?)$/.test(name) && segs.length) out.push(segs);
  }
}

/** Premiers segments des pages publiques (hors espaces) : ils existent aussi hors de /app (ex. /boutique/<adresse>). */
function publicRoots(appDir: string) {
  const roots = new Set<string>();
  for (const name of readdirSync(appDir)) {
    const full = join(appDir, name);
    if (!statSync(full).isDirectory() || name === "app" || name === "espace-client") continue;
    if (/^\(.*\)$/.test(name)) for (const sub of readdirSync(full)) { if (statSync(join(full, sub)).isDirectory()) roots.add(sub); }
    else roots.add(name);
  }
  return roots;
}

function build(appDir: string, space: "app" | "espace-client", shared: Set<string>): SpaceRoute[] {
  const list: string[][] = [];
  walk(join(appDir, space), [], list);
  return list.map((segs) => {
    // Sous une racine partagée avec une page publique, un segment variable n'accepte qu'un identifiant (uuid),
    // pour ne jamais capter /vehicules/<adresse-publique>.
    const strict = shared.has(segs[0]!);
    const src: string[] = [];
    const re: string[] = [];
    for (const s of segs) {
      const catchAll = /^\[\.\.\.(\w+)\]$/.exec(s);
      const dyn = /^\[(\w+)\]$/.exec(s);
      if (catchAll) { src.push(`:${catchAll[1]}+`); re.push(".+"); }
      else if (dyn) { src.push(strict ? `:${dyn[1]}(${UUID})` : `:${dyn[1]}`); re.push(strict ? UUID : "[^/]+"); }
      else { src.push(s); re.push(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); }
    }
    return { source: `/${src.join("/")}`, regex: `^/${re.join("/")}/?$` };
  });
}

export function spaceRoutes(appDir: string): SpaceRoutes {
  const shared = publicRoots(appDir);
  return { pro: build(appDir, "app", shared), client: build(appDir, "espace-client", shared) };
}
