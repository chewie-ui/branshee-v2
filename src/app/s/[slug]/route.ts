import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, sites } from "@/db/schema";

/** Ancienne adresse des sites « /s/<slug> » : redirection permanente vers l'adresse de l'établissement. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [row] = await db.select({ slug: businesses.slug }).from(sites).innerJoin(businesses, eq(businesses.id, sites.businessId)).where(eq(sites.slug, slug.toLowerCase()));
  return row ? NextResponse.redirect(new URL(`/${row.slug}`, req.url), 308) : new NextResponse("Introuvable", { status: 404 });
}
