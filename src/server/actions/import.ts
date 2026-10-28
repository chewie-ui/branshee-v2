"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { db } from "@/db";
import { activityLogs, customers, products, stockMoves } from "@/db/schema";
import { MAX_CELL, MAX_COLS, MAX_ROWS, guessMapping, parseCsv, toClients, toProducts, zipStats, type ImportKind } from "@/lib/import";
import { currentBrand } from "@/server/brand";
import { clientWord } from "@/lib/terminology";
import { requireContext, type AppContext } from "@/server/context";
import { stockRights } from "@/server/stock";

type Preview = { ok: true; headers: string[]; sample: string[][]; mapping: Record<string, number>; total: number } | { ok: false; error: string };
type Done = { ok: true; created: number; skipped: number; errors: { line: number; reason: string }[] } | { ok: false; error: string };

const SUPERVISION = { ok: false as const, error: "Action réservée au titulaire du compte (session de supervision)." };

async function rightsFor(ctx: AppContext, kind: ImportKind) {
  if (kind !== "clients" && kind !== "produits") return { ok: false as const, error: "Import inconnu." };
  if ((await currentBrand()).id !== "skydev") return { ok: false as const, error: "Import indisponible." };
  if (!ctx.canApp(kind === "clients" ? "clients" : "stock")) return { ok: false as const, error: "Vous n'avez pas accès à cette app." };
  if (ctx.impersonating) return SUPERVISION;
  if (kind === "clients" && !ctx.can("customers.manage")) return { ok: false as const, error: "Vous n'avez pas le droit de créer des fiches." };
  if (kind === "produits" && !stockRights(ctx).manage) return { ok: false as const, error: "Seul le responsable ajoute des produits." };
  return null;
}

/** Lit le fichier envoyé : CSV (UTF-8 ou Windows-1252, comme les exports Excel belges) ou classeur Excel (première feuille). */
async function readRows(fd: FormData): Promise<string[][] | string> {
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return "Choisissez un fichier.";
  if (file.size > 5 * 1024 * 1024) return "Fichier trop lourd (5 Mo maximum).";
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".xlsx")) {
    const z = zipStats(buf);
    if (!z || z.entries > 200 || z.uncompressed > 40 * 1024 * 1024) return "Ce fichier Excel est trop volumineux une fois ouvert : enregistrez-le en .csv ou découpez-le.";
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
      const ws = wb.worksheets[0];
      if (!ws) return "Le classeur est vide.";
      const rows: string[][] = [];
      ws.eachRow({ includeEmpty: false }, (row) => {
        if (rows.length > MAX_ROWS + 1) return;
        const out: string[] = [];
        for (let i = 1; i <= Math.min(row.cellCount, MAX_COLS); i++) out.push(String(row.getCell(i).text ?? "").trim().slice(0, MAX_CELL));
        if (out.some((c) => c)) rows.push(out);
      });
      return rows;
    } catch {
      return "Ce fichier Excel n'a pas pu être lu. Enregistrez-le en .xlsx ou en .csv.";
    }
  }
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buf);
    return parseCsv(text);
  }
  return "Format non reconnu : utilisez un fichier .csv ou .xlsx (pour un .xls, enregistrez-le d'abord en .xlsx).";
}

/** Étape 1 : aperçu du fichier et colonnes devinées. */
export async function previewImport(kind: ImportKind, fd: FormData): Promise<Preview> {
  const ctx = await requireContext();
  const denied = await rightsFor(ctx, kind);
  if (denied) return denied;
  const rows = await readRows(fd);
  if (typeof rows === "string") return { ok: false, error: rows };
  if (rows.length < 2) return { ok: false, error: "Le fichier doit contenir une ligne d'en-têtes puis au moins une ligne." };
  if (rows.length - 1 > MAX_ROWS) return { ok: false, error: `${MAX_ROWS} lignes maximum par import : découpez le fichier.` };
  const headers = rows[0]!.map((h, i) => h || `Colonne ${i + 1}`);
  return { ok: true, headers, sample: rows.slice(1, 6), mapping: guessMapping(headers, kind), total: rows.length - 1 };
}

/** Étape 2 : création des fiches. Les clients déjà connus (même email) et les produits au code-barres existant sont ignorés. */
export async function runImport(kind: ImportKind, fd: FormData, mapping: Record<string, number>): Promise<Done> {
  const ctx = await requireContext();
  const denied = await rightsFor(ctx, kind);
  if (denied) return denied;
  const rows = await readRows(fd);
  if (typeof rows === "string") return { ok: false, error: rows };
  if (rows.length - 1 > MAX_ROWS) return { ok: false, error: `${MAX_ROWS} lignes maximum par import : découpez le fichier.` };
  const width = rows[0]?.length ?? 0;
  const map: Record<string, number> = {};
  for (const [k, v] of Object.entries(mapping ?? {})) if (typeof k === "string" && Number.isInteger(v) && v >= -1 && v < width) map[k] = v;
  const data = rows.slice(1);
  let created = 0;

  if (kind === "clients") {
    if (!(map.fullName! >= 0 || map.firstName! >= 0 || map.lastName! >= 0 || map.companyName! >= 0)) return { ok: false, error: "Indiquez au moins la colonne du nom." };
    const { ok, errors } = toClients(data, map);
    // Un même email deux fois dans le fichier : la première ligne gagne.
    const seen = new Set<string>();
    const unique = ok.filter((c) => !c.email || (!seen.has(c.email) && !!seen.add(c.email)));
    for (let i = 0; i < unique.length; i += 500) {
      const chunk = unique.slice(i, i + 500);
      const res = await db.insert(customers).values(chunk.map((c) => ({ ...c, businessId: ctx.business.id, createdManually: true }))).onConflictDoNothing().returning({ id: customers.id });
      created += res.length;
    }
    await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "customer.import", description: `Import : ${created} fiche${created > 1 ? "s" : ""} ${clientWord(ctx.business.businessType, { plural: created > 1 })} créée${created > 1 ? "s" : ""}` });
    revalidatePath("/app/clients");
    return { ok: true, created, skipped: ok.length - created, errors: errors.slice(0, 50) };
  }

  if (!(map.name! >= 0)) return { ok: false, error: "Indiquez au moins la colonne du nom du produit." };
  const { ok, errors } = toProducts(data, map);
  for (let i = 0; i < ok.length; i += 500) {
    const chunk = ok.slice(i, i + 500);
    await db.transaction(async (tx) => {
      const res = await tx
        .insert(products)
        .values(chunk.map((p) => ({ businessId: ctx.business.id, name: p.name, priceCents: p.priceCents, vatRate: p.vatRate, sku: p.sku, barcode: p.barcode, category: p.category, trackStock: true, stockQty: p.stockQty, minQty: p.minQty, costCents: p.costCents, supplier: p.supplier })))
        .onConflictDoNothing()
        .returning({ id: products.id, qty: products.stockQty });
      const moves = res.filter((r) => r.qty !== 0).map((r) => ({ businessId: ctx.business.id, productId: r.id, delta: r.qty, reason: "count", note: "Stock de départ (import)", memberId: ctx.member.id }));
      if (moves.length) await tx.insert(stockMoves).values(moves);
      created += res.length;
    });
  }
  await db.insert(activityLogs).values({ businessId: ctx.business.id, userId: ctx.user.id, actorName: ctx.user.name, action: "product.import", description: `Import : ${created} produit${created > 1 ? "s" : ""} créé${created > 1 ? "s" : ""}` });
  revalidatePath("/app/stock");
  return { ok: true, created, skipped: ok.length - created, errors: errors.slice(0, 50) };
}
