import { NextResponse, type NextRequest } from "next/server";
import { absoluteUrl } from "@/lib/app-url";

/**
 * Lien « annuler / reprogrammer » des emails de l'ancien Branshee : /cancel-booking/<id>?token=<jeton>.
 * La migration a repris le jeton tel quel : on renvoie vers la page de gestion du RDV.
 */
export function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  return NextResponse.redirect(absoluteUrl(/^[a-f0-9]{64}$/.test(token) ? `/r/${token}` : "/"), 308);
}
