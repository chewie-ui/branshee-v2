import { NextResponse, type NextRequest } from "next/server";
import { bareHost, brandForHost, skydevHosts } from "@/lib/brand";
import { legacyRedirect } from "@/lib/custom-services";
import { localeOfPath, localize } from "@/lib/site-locale";
import { appPathForHost } from "@/lib/app-subdomains";

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
  // Après le passage à Skydev (BRANSHEE_TO_SKYDEV=1) : toute adresse branshee.com renvoie vers la même page sur skydev.be
  // (agendas des pros, espace pro, liens des e-mails…), en 301, le temps que chacun change ses liens.
  // Pas en POST, ni pour les webhooks, les retours de connexion (Google) et les flux d'agenda, qui restent servis ici.
  if (process.env.BRANSHEE_TO_SKYDEV === "1" && (host === "branshee.com" || host === "www.branshee.com") && (request.method === "GET" || request.method === "HEAD") && !/^\/(api|auth|account|ical|_next|\.well-known)(\/|$)/.test(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL(request.nextUrl.pathname + request.nextUrl.search, "https://skydev.be"), 301);
  }
  if (host === "www.branshee.com" && (request.method === "GET" || request.method === "HEAD")) {
    const url = new URL(request.nextUrl.pathname + request.nextUrl.search, "https://branshee.com");
    return NextResponse.redirect(url, 301);
  }
  const path = request.nextUrl.pathname;
  // Skydev : adresse directe d'une app (calendar.skydev.be…) → l'app dans l'espace sur skydev.be.
  // Sans session, la garde plus bas renvoie vers la connexion, puis vers l'app.
  const appPath = request.method === "GET" || request.method === "HEAD" ? appPathForHost(host) : null;
  if (appPath && !/^\/(_next|api)\//.test(path)) {
    const local = /\.localhost(:\d+)?$/.test(host);
    const base = local ? `http://skydev.localhost${host.match(/:\d+$/)?.[0] ?? ""}` : "https://skydev.be";
    return NextResponse.redirect(new URL(appPath, base), 302);
  }
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
  // Skydev : première visite d'une page du site en français, navigateur dans une autre langue → version anglaise.
  // Une seule fois : dès qu'une page est vue, la langue est retenue (cookie posé par la page), et le bouton FR / EN la change.
  // Jamais pour les robots (Google doit voir les deux versions) ni pour les requêtes internes de Next.
  if (request.method === "GET" && brandForHost(host) === "skydev" && !request.cookies.has("site_lang") && localeOfPath(path) === "fr" && /^\/(?:$|apps(?:\/|$)|sur-mesure(?:\/|$)|logiciel(?:\/|$)|inscription$|connexion$|mot-de-passe-oublie$)/.test(path) && !request.headers.get("rsc") && (request.headers.get("accept") ?? "").includes("text/html") && !/bot|crawl|spider|slurp|preview|lighthouse|facebookexternalhit/i.test(request.headers.get("user-agent") ?? "")) {
    const first = (request.headers.get("accept-language") ?? "").split(",")[0]?.split(";")[0]?.trim().toLowerCase().split("-")[0] ?? "";
    if (first && first !== "fr" && first !== "*") {
      const to = localize(path, "en");
      if (to !== path) {
        const url = request.nextUrl.clone();
        url.pathname = to;
        const res = NextResponse.redirect(url, 307);
        res.headers.set("Vary", "Accept-Language, Cookie");
        return res;
      }
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
