import { NextResponse, type NextRequest } from "next/server";
import { z } from "@/lib/zod";
import { getSessionUser } from "@/server/auth/session";
import { supportLive } from "@/server/support";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

/** Chat de support vu par l'équipe (super-admin) : messages en direct, « le pro écrit… », « Vu ». */
export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getSessionUser();
  if (!session?.user.isSuperadmin || session.impersonatedById) return NextResponse.json({ error: "auth" }, { status: 404, headers: NO_STORE });
  const id = z.uuid().safeParse((await params).userId);
  if (!id.success) return NextResponse.json({ error: "id" }, { status: 400, headers: NO_STORE });
  const since = req.nextUrl.searchParams.get("since");
  const d = since ? new Date(since) : null;
  const data = await supportLive(id.data, "admin", { since: d && !isNaN(d.getTime()) ? d : null, markRead: req.nextUrl.searchParams.get("read") === "1" });
  return NextResponse.json(data, { headers: NO_STORE });
}
