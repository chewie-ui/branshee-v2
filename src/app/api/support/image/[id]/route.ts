import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { supportMessages } from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";
import { readPrivateFile, sniffImage } from "@/server/storage";

/** Image d'un message de support : visible par le pro de la discussion et par l'équipe uniquement. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  const id = z.uuid().safeParse((await params).id);
  if (!session || !id.success) return new NextResponse(null, { status: 404 });
  const [m] = await db.select({ owner: supportMessages.threadUserId, ref: supportMessages.imageRef }).from(supportMessages).where(eq(supportMessages.id, id.data));
  if (!m?.ref || (m.owner !== session.user.id && !session.user.isSuperadmin)) return new NextResponse(null, { status: 404 });
  const data = await readPrivateFile(m.ref);
  return new NextResponse(new Uint8Array(data), { headers: { "Content-Type": sniffImage(data) ?? "application/octet-stream", "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" } });
}
