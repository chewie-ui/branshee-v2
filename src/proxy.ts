import { NextResponse, type NextRequest } from "next/server";

/** Pages réservées aux personnes connectées (la vérification complète se fait côté serveur dans `requireContext`). */
const PROTECTED = [/^\/app(\/|$)/, /^\/admin(\/|$)/, /^\/bienvenue$/, /^\/espace-client(\/|$)/, /^\/verifier-email$/];

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
  if (PROTECTED.some((r) => r.test(path)) && !request.cookies.has("bs_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    const next = path + request.nextUrl.search;
    if (next !== "/app") url.searchParams.set("suite", next);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
