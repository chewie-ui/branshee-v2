/**
 * Adresse IP du visiteur derrière Nginx. Nginx AJOUTE l'IP réelle en fin de X-Forwarded-For
 * ($proxy_add_x_forwarded_for) : les premières valeurs viennent du client et peuvent être inventées.
 * On prend donc la DERNIÈRE (ou X-Real-IP si Nginx la fournit), jamais la première.
 */
export function clientIp(h: { get(name: string): string | null }): string | null {
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const last = h.get("x-forwarded-for")?.split(",").pop()?.trim();
  return last || null;
}
