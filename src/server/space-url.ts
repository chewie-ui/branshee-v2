import "server-only";
import { headers } from "next/headers";
import { spaceInternalPath, spaceOfHost, spaceShortPath, spaceUrlFromMainHost } from "@/lib/app-subdomains";

/**
 * Adresse à utiliser pour une page des espaces, vue depuis l'adresse actuelle :
 * sur skydev.be, « /app/agenda » → « https://pro.skydev.be/agenda » ; sur pro.skydev.be elle reste « /app/agenda ».
 * Ailleurs (branshee.com, domaine d'un pro) : inchangée.
 */
export async function spaceHref(path: string): Promise<string> {
  const host = ((await headers()).get("host") ?? "").toLowerCase();
  const [p, q = ""] = path.split(/(?=[?#])/);
  const abs = spaceUrlFromMainHost(host, p!);
  // Même espace : on garde l'adresse longue. Une action qui redirige fait rendre la page cible par le serveur
  // sans passer par les réécritures (« /agenda » y serait introuvable) ; la barre d'adresse est raccourcie ensuite
  // par <SpaceUrlFix />.
  return abs ? abs + q : path;
}

/**
 * Lien de navigation interne : sur pro.skydev.be / client.skydev.be, l'adresse courte (« /app/clients/x » → « /clients/x »)
 * pour que la navigation ne passe pas par une redirection (le routeur ne mettait parfois pas la page à jour).
 */
export async function navHref(path: string): Promise<string> {
  const host = ((await headers()).get("host") ?? "").toLowerCase();
  const space = spaceOfHost(host);
  if (!space) return path;
  const [p, q = ""] = path.split(/(?=[?#])/);
  const short = spaceShortPath(space, p!);
  // Seulement si l'adresse courte est bien servie par la réécriture de l'espace.
  return short && spaceInternalPath(space, short) ? short + q : path;
}
