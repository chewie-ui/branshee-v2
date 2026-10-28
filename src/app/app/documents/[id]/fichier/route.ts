import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { requireContext } from "@/server/context";
import { fileResponse } from "@/server/document-response";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Introuvable", { status: 404 });
  const [d] = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.businessId, ctx.business.id)));
  if (!d) return new Response("Introuvable", { status: 404 });
  return fileResponse(d, new URL(req.url).searchParams.has("telecharger"));
}
