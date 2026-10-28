import ExcelJS from "exceljs";
import { isMonth } from "@/lib/payroll";
import { todayIn } from "@/lib/planning";
import { requireContext } from "@/server/context";
import { payrollMonth, payrollRights } from "@/server/payroll";

/** Export Excel des prestations du mois pour le secrétariat social (une ligne par personne). */
export async function GET(req: Request) {
  const ctx = await requireContext();
  if (!payrollRights(ctx).manage) return new Response("Accès refusé", { status: 403 });
  const q = new URL(req.url).searchParams.get("mois");
  const month = isMonth(q) ? q : todayIn(ctx.business.timezone).slice(0, 7);
  const { rows, closedAt } = await payrollMonth(ctx.business.id, month);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Skydev";
  const ws = wb.addWorksheet(`Prestations ${month}`, { views: [{ state: "frozen", ySplit: 2 }] });
  ws.addRow([`${ctx.business.name} — prestations ${month}${closedAt ? " (validé)" : " (provisoire)"}`]).font = { bold: true, size: 13 };
  const head = ws.addRow(["Matricule", "Nom", "Heures prestées", "Dont ajustement", "Heures contrat", "Jours prestés", "Congés (j)", "Maladie (j)", "Récupération (j)", "Sans solde (j)", "Formation (j)", "Autres absences (j)", "Chèques-repas", "Primes brutes (€)", "Km", "Brut indicatif (€)", "Remarque"]);
  head.font = { bold: true };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF0FF" } }; });
  const h = (m: number) => Math.round((m / 60) * 100) / 100;
  const abs = (r: (typeof rows)[number], k: string) => r.absences.find((a) => a.kind === k)?.days ?? 0;
  for (const r of rows) {
    ws.addRow([r.profile?.externalId ?? "", r.name, h(r.minutes), h(r.adjustMinutes), r.contract !== null ? h(r.contract) : "", r.days, abs(r, "conge"), abs(r, "maladie"), abs(r, "recup"), abs(r, "sans_solde"), abs(r, "formation"), abs(r, "autre"), r.mealVouchers, r.bonusCents / 100, r.km, r.gross !== null ? r.gross / 100 : "", r.note]);
  }
  ws.columns.forEach((c, i) => { c.width = i === 1 ? 24 : i === 16 ? 36 : 14; });
  ws.addRow([]);
  ws.addRow(["Heures reprises du Planning Skydev, absences validées dans Congés. Le brut est indicatif : fiches de paie établies par le secrétariat social."]).font = { italic: true, color: { argb: "FF52525B" } };
  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="prestations-${month}.xlsx"`, "Cache-Control": "no-store" } });
}
