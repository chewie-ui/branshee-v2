"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "@/lib/zod";
import { clientIp } from "@/lib/client-ip";
import { rateLimit } from "@/server/auth/rate-limit";
import { issueOrderInvoice } from "@/server/order-invoice";
import { orderByToken } from "@/server/shop";

const schema = z.object({
  street: z.string().trim().min(3).max(120),
  postalCode: z.string().trim().regex(/^\d{4,5}$/),
  city: z.string().trim().min(2).max(80),
  company: z.string().trim().max(120).optional(),
  vatNumber: z.string().trim().max(30).optional(),
});

/** Le client demande la facture de sa commande payée, en donnant son adresse (obligatoire sur une facture). */
export async function requestOrderInvoice(token: string, input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const ip = clientIp(await headers()) ?? "unknown";
  if (!rateLimit(`order-invoice:${ip}`, 10, 60 * 60 * 1000).ok) return { ok: false, error: "Trop de tentatives. Réessayez plus tard." };
  const r = await orderByToken(token);
  if (!r) return { ok: false, error: "Commande introuvable." };
  const v = schema.safeParse(input);
  if (!v.success) return { ok: false, error: "Vérifiez l'adresse : rue et numéro, code postal (4 chiffres) et ville." };
  const res = await issueOrderInvoice(r.o.id, v.data);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath(`/commande/${token}`);
  return { ok: true };
}
