/**
 * Adresse publique du site, pour les redirections des route handlers : derrière Nginx, `req.url`
 * vaut « http(s)://localhost:3060/… » et ne doit jamais servir à construire un lien.
 */
export const appOrigin = () => (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");
export const absoluteUrl = (path: string) => new URL(path, appOrigin() + "/");
