import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { authUrl, googleConfigured, signState } from "@/server/google";

const appUrl = () => (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");

/** Départ vers Google : connexion (`?intention=connexion`) ou Google Agenda (`?intention=agenda`). */
export async function GET(req: NextRequest) {
  if (!googleConfigured()) return NextResponse.redirect(`${appUrl()}/connexion?google=indisponible`);
  const intent = req.nextUrl.searchParams.get("intention") === "agenda" ? "calendar" : "login";
  const suite = req.nextUrl.searchParams.get("suite") ?? "";
  if (intent === "calendar") {
    const s = await getSessionUser();
    if (!s) return NextResponse.redirect(`${appUrl()}/connexion`);
    return NextResponse.redirect(authUrl("calendar", signState({ i: "calendar", u: s.user.id })));
  }
  return NextResponse.redirect(authUrl("login", signState({ i: "login", s: /^\/(?!\/)[\w\-/?=&%.]*$/.test(suite) ? suite : "" })));
}
