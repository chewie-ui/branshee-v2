import { NextResponse, type NextRequest } from "next/server";

/**
 * Garde légère : sans cookie de session, l'espace pro renvoie vers la connexion.
 * La vérification complète (session valide, compte actif, droits) est faite côté serveur
 * dans `requireContext` — le proxy ne fait qu'éviter un aller-retour inutile.
 */
export function proxy(request: NextRequest) {
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

export const config = { matcher: ["/app/:path*", "/bienvenue"] };
