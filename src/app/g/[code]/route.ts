import { NextResponse, type NextRequest } from "next/server";
import { like } from "drizzle-orm";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { rateLimit } from "@/server/auth/rate-limit";

/**
 * Lien court des SMS (« Gérer : branshee.com/g/<16 caractères> ») : début du jeton secret du RDV (64 bits),
 * pour que le SMS tienne en un seul message. Redirige vers la page de gestion habituelle.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`short:${ip}`, 60, 60_000).ok) return new NextResponse("Trop de requêtes", { status: 429 });
  if (!/^[a-f0-9]{16}$/.test(code)) return NextResponse.redirect(new URL("/", req.url), 307);
  const rows = await db.select({ token: appointments.manageToken }).from(appointments).where(like(appointments.manageToken, `${code}%`)).limit(2);
  return rows.length === 1 ? NextResponse.redirect(new URL(`/r/${rows[0]!.token}`, req.url), 307) : NextResponse.redirect(new URL("/", req.url), 307);
}
