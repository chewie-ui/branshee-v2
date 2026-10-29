import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";

/** Entreprise de démonstration : les pages publiques s'affichent, mais rien ne s'enregistre. */
export async function isDemoBusiness(businessId: string) {
  const [b] = await db.select({ d: businesses.isDemo }).from(businesses).where(eq(businesses.id, businessId));
  return !!b?.d;
}
