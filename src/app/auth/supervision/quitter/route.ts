import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser, stopImpersonation } from "@/server/auth/session";

/** Quitte la session supervisée et revient dans l'espace super-admin. */
export async function GET(request: NextRequest) {
  const s = await getSessionUser();
  if (!s?.impersonatedById) return NextResponse.redirect(new URL("/app", request.url));
  await stopImpersonation();
  return NextResponse.redirect(new URL(`/admin/utilisateurs/${s.user.id}`, request.url));
}
