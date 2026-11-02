/**
 * Adresse IP du visiteur derrière Nginx. Nginx AJOUTE l'IP réelle en fin de X-Forwarded-For
 * ($proxy_add_x_forwarded_for) : les premières valeurs viennent du client et peuvent être inventées.
 * On prend donc la DERNIÈRE valeur, jamais la première.
 * X-Real-IP n'est lu qu'en dernier recours : si Nginx ne l'écrase pas (cas de branshee.com et de la
 * préproduction), c'est le visiteur qui la choisit, et il pourrait contourner toutes les limites de débit.
 */
export function clientIp(h: { get(name: string): string | null }): string | null {
  const last = h.get("x-forwarded-for")?.split(",").pop()?.trim();
  if (last) return last;
  return h.get("x-real-ip")?.trim() || null;
}
