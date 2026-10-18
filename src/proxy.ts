import { NextResponse, type NextRequest } from "next/server";

const appHost = () => {
  try {
    return new URL(process.env.APP_URL ?? "https://branshee.com").hostname.replace(/^www\./, "");
  } catch {
    return "branshee.com";
  }
};
const isCustomHost = (host: string) => {
  const h = host.split(":")[0]!.toLowerCase().replace(/^www\./, "");
  return !!h && h !== appHost() && h !== "localhost" && !/^[\d.]+$/.test(h) && !h.endsWith(".localhost");
};

/**
 * 1. Domaine personnalisé (« Mon site ») : « / » est servi par la page de l'établissement lié à ce domaine.
 * 2. Garde légère : sans cookie de session, l'espace pro renvoie vers la connexion.
 *    La vérification complète (session valide, compte actif, droits) est faite côté serveur dans `requireContext`.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  if (pathname === "/" && isCustomHost(host)) {
    const url = request.nextUrl.clone();
    url.pathname = `/domaine/${encodeURIComponent(host.split(":")[0]!.toLowerCase())}`;
    return NextResponse.rewrite(url);
  }
  if (pathname === "/") return NextResponse.next();
  if (!request.cookies.has("bs_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    const next = request.nextUrl.pathname + request.nextUrl.search;
    if (next !== "/app") url.searchParams.set("suite", next);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/", "/app/:path*", "/admin/:path*", "/bienvenue", "/espace-client/:path*", "/espace-client", "/verifier-email"] };
