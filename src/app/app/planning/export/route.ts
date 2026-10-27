import ExcelJS from "exceljs";
import { DAY_SHORT, fmtHours, isDay, isoWeek, mondayOf, shiftMinutes, todayIn, weekDays } from "@/lib/planning";
import { requireContext } from "@/server/context";
import { weekPlanning } from "@/server/planning";

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Export Excel du planning d'une semaine : la grille (une ligne par personne) et le détail des plages. */
export async function GET(req: Request) {
  const ctx = await requireContext();
  const q = new URL(req.url).searchParams.get("semaine");
  const monday = mondayOf(isDay(q) ? q : todayIn(ctx.business.timezone));
  const days = weekDays(monday);
  const { members, shifts } = await weekPlanning(ctx, monday);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Skydev";
  const grid = wb.addWorksheet(`Semaine ${isoWeek(monday)}`, { views: [{ state: "frozen", xSplit: 1, ySplit: 2 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  grid.addRow([`${ctx.business.name} — planning semaine ${isoWeek(monday)} (${dm(days[0]!)} au ${dm(days[6]!)}/${monday.slice(0, 4)})`]).font = { bold: true, size: 13 };
  const head = grid.addRow(["Personne", ...days.map((d, i) => `${DAY_SHORT[i]} ${dm(d)}`), "Total"]);
  head.font = { bold: true };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF0FF" } }; c.alignment = { vertical: "middle" }; });
  for (const m of members) {
    const mine = shifts.filter((s) => s.memberId === m.id);
    const total = mine.reduce((a, s) => a + shiftMinutes(s.start, s.end, s.breakMinutes), 0);
    const row = grid.addRow([
      m.role ? `${m.name}\n${m.role}` : m.name,
      ...days.map((d) => mine.filter((s) => s.day === d).map((s) => `${s.start}–${s.end}${s.label ? ` ${s.label}` : ""}`).join("\n")),
      fmtHours(total),
    ]);
    row.alignment = { wrapText: true, vertical: "top" };
  }
  grid.getColumn(1).width = 24;
  for (let i = 2; i <= 8; i++) grid.getColumn(i).width = 18;
  grid.getColumn(9).width = 10;

  const detail = wb.addWorksheet("Détail");
  detail.addRow(["Date", "Jour", "Personne", "Début", "Fin", "Pause (min)", "Heures", "Poste", "Note"]).font = { bold: true };
  const name = new Map(members.map((m) => [m.id, m.name]));
  for (const s of shifts) {
    const i = days.indexOf(s.day);
    detail.addRow([s.day, DAY_SHORT[i] ?? "", name.get(s.memberId) ?? "", s.start, s.end, s.breakMinutes, Math.round((shiftMinutes(s.start, s.end, s.breakMinutes) / 60) * 100) / 100, s.label ?? "", s.note ?? ""]);
  }
  [12, 6, 24, 8, 8, 11, 9, 18, 30].forEach((w, i) => (detail.getColumn(i + 1).width = w));

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="planning-semaine-${isoWeek(monday)}-${monday}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
