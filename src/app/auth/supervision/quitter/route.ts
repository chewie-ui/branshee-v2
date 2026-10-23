import { NextResponse } from "next/server";
import { getSessionUser, stopImpersonation } from "@/server/auth/session";
import { absoluteUrl } from "@/lib/app-url";

/** Quitte la session supervisée et revient dans l'espace super-admin. */
export async function GET() {
  const s = await getSessionUser();
  if (!s?.impersonatedById) return NextResponse.redirect(absoluteUrl("/app"));
  await stopImpersonation();
  return NextResponse.redirect(absoluteUrl(`/admin/utilisateurs/${s.user.id}`));
}
