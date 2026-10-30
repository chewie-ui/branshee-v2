"use server";

import { revalidatePath } from "next/cache";
import { eq, isNull } from "drizzle-orm";
import { z } from "@/lib/zod";
import { db } from "@/db";
import { errorLogs } from "@/db/schema";
import { requireSuperadmin } from "@/server/admin";

/** Admin › Santé : marquer une erreur (ou toutes) comme réglée. Elle se rouvre si elle revient. */
export async function resolveError(id: string | "all"): Promise<{ ok: boolean }> {
  await requireSuperadmin();
  if (id === "all") await db.update(errorLogs).set({ resolvedAt: new Date() }).where(isNull(errorLogs.resolvedAt));
  else if (z.uuid().safeParse(id).success) await db.update(errorLogs).set({ resolvedAt: new Date() }).where(eq(errorLogs.id, id));
  revalidatePath("/admin", "layout");
  return { ok: true };
}
