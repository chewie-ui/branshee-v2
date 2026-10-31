import "server-only";
import { headers } from "next/headers";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { GET as proofFile } from "@/app/app/depenses/[id]/justificatif/route";
import { GET as expensesCsv } from "@/app/app/depenses/export/route";
import { EXPENSE_CATEGORIES } from "@/lib/expenses";
import { todayIn } from "@/lib/planning";
import { deleteExpense, saveExpense } from "@/server/actions/expenses";
import { fail, forbidden, formData, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { currentContext, type AppContext } from "@/server/context";
import { getSellerSettings } from "@/server/invoicing";
import { isLocked } from "@/server/plan";

/** API mobile de l'app Dépenses (Skydev) : mêmes données et actions que /app/depenses. */

async function needDepenses(permission: "invoices.view" | "invoices.manage" = "invoices.view"): Promise<AppContext> {
  const ctx = await currentContext();
  if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
  if (!ctx.canApp("depenses") || !ctx.can(permission)) return forbidden();
  const method = (await headers()).get("x-method") ?? "POST";
  if (method !== "GET" && (await isLocked(ctx.business.id, ctx.business.brand))) return fail(402, "read_only", "Votre essai est terminé : abonnez-vous pour continuer à modifier.");
  return ctx;
}

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

async function list(r: ApiRequest) {
  const ctx = await needDepenses();
  const today = todayIn(ctx.business.timezone || "Europe/Brussels");
  const current = Number(today.slice(0, 4));
  const q = Number(r.query.get("year"));
  const year = q >= 2000 && q <= 2100 ? q : current;
  const [rows, [span], seller] = await Promise.all([
    db.select().from(expenses).where(and(eq(expenses.businessId, ctx.business.id), gte(expenses.date, `${year}-01-01`), lte(expenses.date, `${year}-12-31`))).orderBy(desc(expenses.date), desc(expenses.createdAt)).limit(2000),
    db.select({ first: sql<string | null>`min(${expenses.date})::text` }).from(expenses).where(eq(expenses.businessId, ctx.business.id)),
    getSellerSettings(ctx.business.id),
  ]);
  const from = Math.min(span?.first ? Number(span.first.slice(0, 4)) : current, year, current);
  const years = Array.from({ length: Math.max(year, current) - from + 1 }, (_, i) => from + i).slice(-5);
  return {
    year,
    years,
    today,
    franchise: seller.vatRegime === "franchise",
    canManage: ctx.can("invoices.manage"),
    categories: EXPENSE_CATEGORIES,
    expenses: rows.map((e) => ({ id: e.id, date: e.date, supplier: e.supplier, category: e.category, description: e.description, amountCents: e.amountCents, vatCents: e.vatCents, proofName: e.proofName, proofType: e.proofType, hasProof: !!e.proofRef })),
  };
}

/** Ajout / modification : JSON (sans justificatif) ou multipart (champ « proof »). Montants en euros. */
async function save(r: ApiRequest, id: string | null) {
  await needDepenses("invoices.manage");
  if (id && !uuid(id)) return fail(404, "not_found", "Dépense introuvable.");
  let fd: FormData;
  if ((r.raw.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    fd = await r.raw.formData().catch(() => invalid("Envoi illisible."));
    if (id) fd.set("id", id);
  } else {
    const b = r.body;
    fd = formData({ id: id ?? "", date: str(b.date, 10), amount: str(b.amount, 12).replace(",", "."), vat: str(b.vat, 12).replace(",", ".") || "0", supplier: str(b.supplier, 120), category: str(b.category, 80), description: str(b.description, 300), ...(b.removeProof ? { removeProof: "1" } : {}) });
  }
  const res = await saveExpense(fd);
  if (!res.ok) return invalid(res.error);
  return { ok: true, message: res.message };
}

export const depensesRoutes: Route[] = [
  { method: "GET", path: "/expenses", handler: list },
  { method: "POST", path: "/expenses", handler: (r) => save(r, null) },
  { method: "POST", path: "/expenses/:id", handler: (r) => save(r, r.params.id!) },
  { method: "PATCH", path: "/expenses/:id", handler: (r) => save(r, r.params.id!) },
  {
    method: "DELETE",
    path: "/expenses/:id",
    handler: async (r) => {
      await needDepenses("invoices.manage");
      if (!uuid(r.params.id)) return fail(404, "not_found", "Dépense introuvable.");
      const res = await deleteExpense(r.params.id!);
      if (!res.ok) return invalid(res.error);
      return { ok: true };
    },
  },
  {
    method: "GET",
    path: "/expenses/:id/proof",
    handler: async (r) => {
      await needDepenses();
      if (!uuid(r.params.id)) return fail(404, "not_found", "Justificatif introuvable.");
      return proofFile(r.raw, { params: Promise.resolve({ id: r.params.id! }) });
    },
  },
  {
    method: "GET",
    path: "/expenses/export",
    handler: async (r) => {
      await needDepenses();
      return expensesCsv(new Request(`http://local/?annee=${encodeURIComponent(r.query.get("year") ?? "")}`));
    },
  },
];
