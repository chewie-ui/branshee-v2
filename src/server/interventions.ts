import "server-only";
import { and, asc, desc, eq, gte, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { interventions, members } from "@/db/schema";
import type { AppContext } from "@/server/context";

export const interventionRights = (ctx: AppContext) => ({ manage: ctx.member.isOwner || ctx.can("settings.manage") });
export const canWork = (ctx: AppContext, i: { technicianId: string | null }) => interventionRights(ctx).manage || i.technicianId === ctx.member.id;

export async function listInterventions(businessId: string, opts: { from?: Date; to?: Date; technicianId?: string; done?: boolean }) {
  return db
    .select({ i: interventions, tech: members.displayName })
    .from(interventions)
    .leftJoin(members, eq(members.id, interventions.technicianId))
    .where(and(eq(interventions.businessId, businessId), opts.from ? gte(interventions.scheduledAt, opts.from) : undefined, opts.to ? lt(interventions.scheduledAt, opts.to) : undefined, opts.technicianId ? eq(interventions.technicianId, opts.technicianId) : undefined, opts.done === false ? ne(interventions.status, "done") : undefined))
    .orderBy(opts.done === false ? asc(interventions.scheduledAt) : desc(interventions.scheduledAt))
    .limit(500);
}

export async function interventionOf(businessId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await db.select({ i: interventions, tech: members.displayName }).from(interventions).leftJoin(members, eq(members.id, interventions.technicianId)).where(and(eq(interventions.id, id), eq(interventions.businessId, businessId)));
  return r ?? null;
}
