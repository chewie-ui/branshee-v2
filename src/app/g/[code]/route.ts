import { NextResponse, type NextRequest } from "next/server";
import { like } from "drizzle-orm";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { rateLimit } from "@/server/auth/rate-limit";
import { absoluteUrl } from "@/lib/app-url";
import { clientIp } from "@/lib/client-ip";

/**
 * Lien court des SMS (« Gérer : branshee.com/g/<16 caractères> ») : début du jeton secret du RDV (64 bits),
 * pour que le SMS tienne en un seul message. Redirige vers la page de gestion habituelle.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ip = (clientIp(req.headers) ?? "local");
  if (!rateLimit(`short:${ip}`, 60, 60_000).ok) return new NextResponse("Trop de requêtes", { status: 429 });
  if (!/^[a-f0-9]{16}$/.test(code)) return NextResponse.redirect(absoluteUrl("/"), 307);
  const rows = await db.select({ token: appointments.manageToken }).from(appointments).where(like(appointments.manageToken, `${code}%`)).limit(2);
  return rows.length === 1 ? NextResponse.redirect(absoluteUrl(`/r/${rows[0]!.token}`), 307) : NextResponse.redirect(absoluteUrl("/"), 307);
}
