"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { members, users } from "@/db/schema";
import { BUSINESS_COOKIE } from "@/server/auth/session";
import { createBusiness } from "@/server/business";
import { requireUser } from "@/server/context";

export type CreateBusinessState = { fieldErrors?: Record<string, string>; values?: Record<string, string> } | undefined;

const schema = z.object({
  name: z.string().trim().min(2, "Indiquez le nom de votre établissement.").max(80),
  businessType: z.string().trim().max(60),
  city: z.string().trim().max(80),
});

export async function createBusinessAction(_prev: CreateBusinessState, formData: FormData): Promise<CreateBusinessState> {
  const user = await requireUser();
  const values = { name: String(formData.get("name") ?? ""), businessType: String(formData.get("businessType") ?? ""), city: String(formData.get("city") ?? "") };
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors, values };
  }
  const [owner] = await db.select({ id: users.id, fullName: users.fullName }).from(users).where(eq(users.id, user.id));
  const { business } = await createBusiness(owner!, { name: parsed.data.name, businessType: parsed.data.businessType || null, city: parsed.data.city || null });
  (await cookies()).set(BUSINESS_COOKIE, business.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 365 * 86400 });
  redirect("/app");
}

/** Change l'établissement actif (uniquement parmi ceux dont l'utilisateur est membre actif). */
export async function switchBusiness(businessId: string) {
  const user = await requireUser();
  const id = z.uuid().parse(businessId);
  const [m] = await db.select({ id: members.id }).from(members).where(and(eq(members.userId, user.id), eq(members.businessId, id), eq(members.status, "active"), eq(members.isActive, true)));
  if (!m) return;
  (await cookies()).set(BUSINESS_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 365 * 86400 });
  redirect("/app");
}
