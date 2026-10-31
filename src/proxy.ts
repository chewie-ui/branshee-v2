import { NextResponse, type NextRequest } from "next/server";
import { bareHost, brandForHost, skydevHosts } from "@/lib/brand";
import { legacyRedirect } from "@/lib/custom-services";

/** Pages réservées aux personnes connectées (la vérification complète se fait côté serveur dans `requireContext`). */
const PROTECTED = [/^\/app(\/|$)/, /^\/imprimer(\/|$)/, /^\/admin(\/|$)/, /^\/bienvenue$/, /^\/espace-client(\/|$)/, /^\/verifier-email$/];

/**
 * 1) www.branshee.com → branshee.com (une seule adresse pour Google). Seulement en GET/HEAD :
 *    les appels POST (webhook Stripe configuré sur www) ne suivent pas les redirections.
 * 2) Garde légère : sans cookie de session, l'espace pro renvoie vers la connexion.
 * Les domaines personnalisés (« Mon site ») ne sont pas concernés.
 */
export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  if (host === "www.branshee.com" && (request.method === "GET" || request.method === "HEAD")) {
    const url = new URL(request.nextUrl.pathname + request.nextUrl.search, "https://branshee.com");
    return NextResponse.redirect(url, 301);
  }
  const path = request.nextUrl.pathname;
  // Skydev : anciennes pages de l'ancien site (création de site par ville, services) → nouvelles pages, en 301.
  if ((request.method === "GET" || request.method === "HEAD") && brandForHost(host) === "skydev") {
    const to = legacyRedirect(path);
    if (to) {
      // Adresse de destination : jamais l'en-tête Host tel quel (une adresse inconnue renvoie vers skydev.be).
      const known = skydevHosts().includes(bareHost(host)) ? host : "skydev.be";
      const proto = known.endsWith(".localhost") || known.includes(".localhost:") ? "http" : "https";
      return NextResponse.redirect(new URL(to, `${proto}://${known}`), 301);
    }
  }
  if (PROTECTED.some((r) => r.test(path)) && !request.cookies.has("bs_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    const next = path + request.nextUrl.search;
    if (next !== "/app") url.searchParams.set("suite", next);
    return NextResponse.redirect(url);
  }
  // Chemin demandé, pour que l'espace pro sache quelle app est ouverte (toujours réécrit : jamais celui du navigateur).
  const headers = new Headers(request.headers);
  headers.set("x-pathname", path);
  // Méthode réelle (une action = POST, avec ou sans JavaScript) : sert à la lecture seule, jamais fournie par le navigateur.
  headers.set("x-method", request.method);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
