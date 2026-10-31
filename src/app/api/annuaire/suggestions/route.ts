import { NextResponse, type NextRequest } from "next/server";
import { and, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { businesses, users } from "@/db/schema";
import { clientIp } from "@/lib/client-ip";
import { norm } from "@/lib/directory";
import { suggestPlaces } from "@/lib/postcodes";
import { rateLimit } from "@/server/auth/rate-limit";
import { directoryVocabulary } from "@/server/directory";
import { visible } from "@/server/site";

/**
 * Suggestions de la barre de recherche de l'annuaire, pendant la frappe.
 * `type=quoi` : métiers + établissements (nom) ; `type=ou` : localités (code postal ou nom).
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
  const type = req.nextUrl.searchParams.get("type") === "ou" ? "ou" : "quoi";
  if (!q) return NextResponse.json({ items: [] });
  if (!rateLimit(`dir-suggest:${clientIp(req.headers) ?? "?"}`, 120, 60_000).ok) return NextResponse.json({ items: [] }, { status: 429 });
  const vocab = await directoryVocabulary();
  if (type === "ou") {
    const items = suggestPlaces(q, vocab.cities).map((p) => ({ kind: "place" as const, label: p.label, value: p.city }));
    return NextResponse.json({ items }, { headers: { "Cache-Control": "public, max-age=300" } });
  }
  const n = norm(q);
  const metiers = vocab.metierNames
    .filter((m) => norm(m).startsWith(n) || norm(m).includes(` ${n}`))
    .slice(0, 5)
    .map((m) => ({ kind: "metier" as const, label: m, value: m }));
  const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const pros = q.length < 2 ? [] : await db
    .select({ name: businesses.name, slug: businesses.slug, city: businesses.city, type: businesses.businessType })
    .from(businesses)
    .innerJoin(users, eq(users.id, businesses.ownerId))
    .where(and(visible, ilike(businesses.name, pattern)))
    .limit(5);
  const items = [...metiers, ...pros.map((p) => ({ kind: "pro" as const, label: p.name, value: p.name, sub: [p.type, p.city].filter(Boolean).join(" · "), href: `/${p.slug}` }))];
  return NextResponse.json({ items });
}
