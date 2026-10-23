import { NextResponse, type NextRequest } from "next/server";
import { absoluteUrl } from "@/lib/app-url";

/** Ancienne recherche (/search?name=&location=&category=) → annuaire. */
export function GET(req: NextRequest) {
  const old = req.nextUrl.searchParams;
  const url = absoluteUrl("/annuaire");
  const map: Record<string, string> = { name: "q", location: "ou", category: "metier", note: "note" };
  for (const [from, to] of Object.entries(map)) {
    const v = old.get(from);
    if (v) url.searchParams.set(to, v);
  }
  return NextResponse.redirect(url, 308);
}
